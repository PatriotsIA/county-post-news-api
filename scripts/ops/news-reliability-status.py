#!/usr/bin/env python3
"""Read-only, secret-safe County Post release and queue health snapshot.

Requires Python 3 and AWS CLI credentials for profile pia. No SDK dependency.
Missing metrics are reported as null, not as evidence of zero traffic/errors.
Exit 0 means the snapshot completed; it is not a release-readiness verdict.
"""

import argparse
from datetime import datetime, timedelta, timezone
import json
import subprocess
import sys


ACCOUNT = "426771918029"
REGION = "us-east-2"
STACK = "county-news-api"
ALERT_EMAIL = "erik@patriotsinaction.com"
TOPIC = f"arn:aws:sns:{REGION}:{ACCOUNT}:pia-operations-alerts"
ALARM_IDS = (
    "FeedRefreshBacklogAlarm",
    "FeedRefreshDeadLetterAlarm",
    "FeedWarmerFailureAlarm",
    "AtlasBuildFailureAlarm",
    "AtlasStaleDataAlarm",
    "AtlasScheduleFailureAlarm",
    "NewsApiThrottleAlarm",
    "NewsApiExecutionFailureAlarm",
)


def aws(service, operation, *args, query):
    command = [
        "aws", "--profile", "pia", "--region", REGION,
        "--no-cli-pager", "--cli-connect-timeout", "10",
        "--cli-read-timeout", "20", service, operation, *args,
        "--query", query, "--output", "json",
    ]
    result = subprocess.run(command, capture_output=True, text=True, timeout=90)
    if result.returncode:
        # Never echo raw AWS responses or configuration through an exception.
        raise RuntimeError(f"Read-only AWS call failed: {service} {operation}")
    return json.loads(result.stdout)


def queue_status(url):
    return aws(
        "sqs", "get-queue-attributes", "--queue-url", url,
        "--attribute-names", "ApproximateNumberOfMessages",
        "ApproximateNumberOfMessagesNotVisible", "ApproximateNumberOfMessagesDelayed",
        "MessageRetentionPeriod", "VisibilityTimeout", query="Attributes",
    )


def metric_query(identifier, namespace, metric, dimension, value, statistic):
    return {
        "Id": identifier,
        "MetricStat": {
            "Metric": {
                "Namespace": namespace, "MetricName": metric,
                "Dimensions": [{"Name": dimension, "Value": value}],
            },
            "Period": 300, "Stat": statistic,
        },
        "ReturnData": True,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--hours", type=int, default=1, help="Metric window: 1–168 hours (default 1).")
    args = parser.parse_args()
    if not 1 <= args.hours <= 168:
        parser.error("--hours must be between 1 and 168")

    account = aws("sts", "get-caller-identity", query="Account")
    if account != ACCOUNT:
        raise RuntimeError("Profile pia is not the expected PIA account; stopped before inspecting resources.")

    resources = aws(
        "cloudformation", "list-stack-resources", "--stack-name", STACK,
        query="StackResourceSummaries[].{logical:LogicalResourceId,physical:PhysicalResourceId}",
    )
    resources = {item["logical"]: item["physical"] for item in resources}
    api = resources["NewsApiFunction"]
    worker = resources["FeedRefreshFunction"]
    queue = resources["FeedRefreshQueue"]
    queue_name = queue.rsplit("/", 1)[-1]

    snapshot = {
        "observedAtUtc": datetime.now(timezone.utc).isoformat(),
        "account": account, "profile": "pia", "region": REGION,
        "stack": aws(
            "cloudformation", "describe-stacks", "--stack-name", STACK,
            query="Stacks[0].{status:StackStatus,updated:LastUpdatedTime,capacityParameters:Parameters[?ParameterKey==`NewsApiReservedConcurrency` || ParameterKey==`FeedRefreshMaximumConcurrency`].{name:ParameterKey,value:ParameterValue}}",
        ),
        "regionalConcurrency": aws(
            "lambda", "get-account-settings",
            query="AccountLimit.{limit:ConcurrentExecutions,unreserved:UnreservedConcurrentExecutions}",
        ),
        "apiReservedConcurrency": aws(
            "lambda", "get-function-concurrency", "--function-name", api,
            query="ReservedConcurrentExecutions",
        ),
        "workerMapping": aws(
            "lambda", "get-event-source-mapping", "--uuid", resources["FeedRefreshFunctionRefreshQueue"],
            query="{state:State,maximumConcurrency:ScalingConfig.MaximumConcurrency,batchSize:BatchSize,responseTypes:FunctionResponseTypes}",
        ),
        "queue": queue_status(queue),
        "deadLetterQueue": queue_status(resources["FeedRefreshDeadLetterQueue"]),
    }

    alarm_names = [resources[name] for name in ALARM_IDS if name in resources]
    alarms = aws(
        "cloudwatch", "describe-alarms", "--alarm-names", *alarm_names,
        query="MetricAlarms[].{name:AlarmName,state:StateValue,alarmActions:AlarmActions,okActions:OKActions,actionsEnabled:ActionsEnabled}",
    ) if alarm_names else []
    alarms = {alarm["name"]: alarm for alarm in alarms}
    snapshot["alarms"] = {
        name: {
            "deployed": resources.get(name) in alarms,
            "state": alarms.get(resources.get(name), {}).get("state"),
            "actionsEnabled": alarms.get(resources.get(name), {}).get("actionsEnabled"),
            "alarmRoutedToPiaTopic": TOPIC in alarms.get(resources.get(name), {}).get("alarmActions", []),
            "okRoutedToPiaTopic": TOPIC in alarms.get(resources.get(name), {}).get("okActions", []),
        }
        for name in ALARM_IDS
    }
    snapshot["erikEmailSubscriptions"] = aws(
        "sns", "list-subscriptions-by-topic", "--topic-arn", TOPIC,
        query=f"Subscriptions[?Protocol==`email` && Endpoint==`{ALERT_EMAIL}`].{{email:Endpoint,pending:SubscriptionArn==`PendingConfirmation`}}",
    )

    # Every metric uses the exact same completed five-minute time window.
    now = datetime.now(timezone.utc)
    end = now.replace(minute=now.minute - now.minute % 5, second=0, microsecond=0)
    start = end - timedelta(hours=args.hours)
    specs = (
        ("sent", "AWS/SQS", "NumberOfMessagesSent", "QueueName", queue_name, "Sum"),
        ("deleted", "AWS/SQS", "NumberOfMessagesDeleted", "QueueName", queue_name, "Sum"),
        ("queue_oldest_age_peak", "AWS/SQS", "ApproximateAgeOfOldestMessage", "QueueName", queue_name, "Maximum"),
        ("api_throttles", "AWS/Lambda", "Throttles", "FunctionName", api, "Sum"),
        ("api_errors", "AWS/Lambda", "Errors", "FunctionName", api, "Sum"),
        ("worker_throttles", "AWS/Lambda", "Throttles", "FunctionName", worker, "Sum"),
        ("worker_errors", "AWS/Lambda", "Errors", "FunctionName", worker, "Sum"),
        ("api_peak", "AWS/Lambda", "ConcurrentExecutions", "FunctionName", api, "Maximum"),
        ("worker_peak", "AWS/Lambda", "ConcurrentExecutions", "FunctionName", worker, "Maximum"),
    )
    metrics = aws(
        "cloudwatch", "get-metric-data",
        "--start-time", start.isoformat(), "--end-time", end.isoformat(),
        "--metric-data-queries", json.dumps([metric_query(*spec) for spec in specs]),
        query="MetricDataResults[].{id:Id,values:Values,status:StatusCode}",
    )
    snapshot["metrics"] = {
        "startUtc": start.isoformat(), "endUtc": end.isoformat(), "periodSeconds": 300,
        "results": {
            metric["id"]: {
                "value": (max(metric["values"]) if metric["id"].endswith("_peak") else sum(metric["values"])) if metric["values"] else None,
                "datapoints": len(metric["values"]), "status": metric["status"],
            }
            for metric in metrics
        },
        "note": "SQS counts are approximate operation counts, not unique jobs; delayed metrics and retries can affect comparisons. Null means no datapoints. API reservation null means unreserved, not disabled.",
    }
    print(json.dumps(snapshot, indent=2))


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, KeyError, ValueError, OSError, subprocess.TimeoutExpired) as exc:
        print(f"Unable to complete read-only status snapshot: {exc}", file=sys.stderr)
        sys.exit(1)

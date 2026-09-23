#!/usr/bin/env python3
"""One-time PIA-007 migration. Prints names and verification booleans only.

See docs/provider-secrets-2026-09-23.md for release ordering and key rotation.
Values are copied from the running services, compared with the pipeline, then
sent to AWS through mode-0600 temporary files inside a private directory.
Existing different secrets are never overwritten.
"""

import argparse
import copy
import json
from pathlib import Path
import re
import subprocess
import tempfile

ACCOUNT = "426771918029"
REGION = "us-east-2"
PIPELINE = "county-news-api-pipeline"
FUNCTION = "county-news-api-NewsApiFunction-ETSmPRARDYlx"
ATLAS = "county-news-api-atlas-ingestion"
ROLE = "CountyNewsApiCloudFormationDeployRole"
SECRET_ID = "county-news-api/providers"
CENSUS_PARAMETER = "/county-news-api/census-api-key"
SOURCE = "https://github.com/PatriotsIA/county-post-news-api.git"
KEY_ENV = {"UsdaMarsApiKey": "USDA_MARS_API_KEY", "FredApiKey": "FRED_API_KEY", "StripeSecretKey": "STRIPE_SK_KEY"}
SECRET_KEYS = (*KEY_ENV, "CensusApiKey")


class AwsError(RuntimeError):
    def __init__(self, service, operation, code):
        self.code = code
        super().__init__(f"{service} {operation} failed ({code}); raw response suppressed")


def aws(service, operation, payload=None):
    with tempfile.TemporaryDirectory(prefix="pia-secret-migration-") as directory:
        command = ["aws", "--profile", "pia", "--region", REGION, "--no-cli-pager",
                   "--cli-connect-timeout", "10", "--cli-read-timeout", "30", service, operation]
        if payload is not None:
            file = Path(directory) / "request.json"
            file.touch(mode=0o600)
            file.write_text(json.dumps(payload))
            command.extend(["--cli-input-json", f"file://{file}"])
        result = subprocess.run(command + ["--output", "json"], capture_output=True, text=True, timeout=120)
        if result.returncode:
            code = re.search(r"An error occurred \(([A-Za-z0-9]+)\)", result.stderr)
            raise AwsError(service, operation, code.group(1) if code else "RequestFailed")
        return json.loads(result.stdout or "{}")


def deploy_action(pipeline):
    actions = [a for s in pipeline["stages"] for a in s["actions"] if a["actionTypeId"]["provider"] == "CloudFormation"]
    if len(actions) != 1 or actions[0]["configuration"].get("StackName") != "county-news-api":
        raise RuntimeError("Unexpected deployment shape; no pipeline changes made")
    return actions[0]


def migrated_pipeline(pipeline):
    updated = copy.deepcopy(pipeline)
    action = deploy_action(updated)
    overrides = json.loads(action["configuration"]["ParameterOverrides"])
    for key in SECRET_KEYS:
        overrides.pop(key, None)
    overrides["AtlasSourceLocation"] = SOURCE
    action["configuration"]["ParameterOverrides"] = json.dumps(overrides)
    return updated


def running_values(pipeline):
    variables = aws("lambda", "get-function-configuration", {"FunctionName": FUNCTION})["Environment"]["Variables"]
    project = aws("codebuild", "batch-get-projects", {"names": [ATLAS]})["projects"][0]
    census = next(x for x in project["environment"]["environmentVariables"] if x["name"] == "CENSUS_API_KEY")
    if census["type"] != "PLAINTEXT":
        raise RuntimeError("Atlas already migrated; use verify instead of copying values again")
    providers = {key: variables.get(env, "") for key, env in KEY_ENV.items()}
    all_values = {**providers, "CensusApiKey": census["value"]}
    overrides = json.loads(deploy_action(pipeline)["configuration"]["ParameterOverrides"])
    if not all(all_values.values()) or any(overrides.get(key) != value for key, value in all_values.items()):
        raise RuntimeError("Missing or mismatched running/pipeline key; migration stopped without displaying values")
    if variables.get("MARS_API_KEY") != providers["UsdaMarsApiKey"]:
        raise RuntimeError("USDA environment aliases differ; migration stopped")
    return providers, census["value"]


def stored_values():
    secret = aws("secretsmanager", "get-secret-value", {"SecretId": SECRET_ID})
    census = aws("ssm", "get-parameter", {"Name": CENSUS_PARAMETER, "WithDecryption": True})["Parameter"]
    if census["Type"] != "SecureString":
        raise RuntimeError("Census parameter must be SecureString")
    return json.loads(secret["SecretString"]), census["Value"], secret["ARN"]


def store_values(pipeline):
    providers, census = running_values(pipeline)
    # Check both destinations before creating either; never overwrite a rotation.
    try:
        existing = aws("secretsmanager", "get-secret-value", {"SecretId": SECRET_ID})
    except AwsError as error:
        if error.code != "ResourceNotFoundException":
            raise
        existing = None
    try:
        parameter = aws("ssm", "get-parameter", {"Name": CENSUS_PARAMETER, "WithDecryption": True})["Parameter"]
    except AwsError as error:
        if error.code != "ParameterNotFound":
            raise
        parameter = None
    if existing and json.loads(existing["SecretString"]) != providers:
        raise RuntimeError("Provider secret already exists with different values; stopped")
    if parameter and (parameter["Type"] != "SecureString" or parameter["Value"] != census):
        raise RuntimeError("Census parameter already exists with different configuration; stopped")
    if existing is None:
        aws("secretsmanager", "create-secret", {"Name": SECRET_ID, "Description": "County Post API provider credentials; rotate in the provider account before retiring old keys", "SecretString": json.dumps(providers), "Tags": [{"Key": "Project", "Value": "county-news-api"}]})
    if parameter is None:
        aws("ssm", "put-parameter", {"Name": CENSUS_PARAMETER, "Description": "County Post Atlas Census key", "Type": "SecureString", "Tier": "Standard", "Value": census, "Overwrite": False, "Tags": [{"Key": "Project", "Value": "county-news-api"}]})
    saved, saved_census, arn = stored_values()
    if saved != providers or saved_census != census:
        raise RuntimeError("Stored credential verification failed")
    policy = {"Version": "2012-10-17", "Statement": [{"Sid": "ReadCountyNewsProviderSecret", "Effect": "Allow", "Action": "secretsmanager:GetSecretValue", "Resource": arn}]}
    aws("iam", "put-role-policy", {"RoleName": ROLE, "PolicyName": "CountyNewsProviderSecretRead", "PolicyDocument": json.dumps(policy)})
    return {"providerSecret": SECRET_ID, "censusSecureParameter": CENSUS_PARAMETER, "valuesPreserved": True, "deployPermission": "one exact secret ARN"}


def update_pipeline(pipeline):
    providers, census = running_values(pipeline)
    saved, saved_census, _ = stored_values()
    if providers != saved or census != saved_census:
        raise RuntimeError("Secure storage does not match running services")
    state = aws("codepipeline", "get-pipeline-state", {"name": PIPELINE})
    deploy = next(s for s in state["stageStates"] if s["stageName"] == "Deploy")
    if deploy["inboundTransitionState"]["enabled"]:
        raise RuntimeError("Pause the Deploy inbound transition before changing pipeline parameters")
    if deploy.get("latestExecution", {}).get("status") == "InProgress":
        raise RuntimeError("Wait for the active deployment to finish")
    updated = migrated_pipeline(pipeline)
    response = aws("codepipeline", "update-pipeline", {"pipeline": updated})["pipeline"]
    expected = copy.deepcopy(updated)
    expected["version"] = response["version"]
    if response != expected:
        raise RuntimeError("Pipeline readback differs beyond the expected version increment; inspect names only")
    return {"pipelineVersion": response["version"], "removedOverrides": list(SECRET_KEYS), "atlasSource": SOURCE, "otherPipelineSettingsPreserved": True}


def verify(pipeline):
    providers, _, _ = stored_values()
    variables = aws("lambda", "get-function-configuration", {"FunctionName": FUNCTION})["Environment"]["Variables"]
    project = aws("codebuild", "batch-get-projects", {"names": [ATLAS]})["projects"][0]
    census = next(x for x in project["environment"]["environmentVariables"] if x["name"] == "CENSUS_API_KEY")
    overrides = json.loads(deploy_action(pipeline)["configuration"]["ParameterOverrides"])
    result = {"pipelineContainsNoCredentialOverrides": not set(SECRET_KEYS).intersection(overrides), "readerValuesMatchSecureStorage": all(variables.get(env) == providers[key] for key, env in KEY_ENV.items()), "usdaAliasPreserved": variables.get("MARS_API_KEY") == providers["UsdaMarsApiKey"], "atlasUsesSecureParameter": census["type"] == "PARAMETER_STORE" and census["value"] == CENSUS_PARAMETER, "atlasUsesCurrentRepository": project["source"]["location"] == SOURCE}
    if not all(result.values()):
        raise RuntimeError("Migration verification incomplete: " + json.dumps(result))
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("phase", choices=["inspect", "store", "pipeline", "verify"])
    args = parser.parse_args()
    if aws("sts", "get-caller-identity")["Account"] != ACCOUNT:
        raise RuntimeError("Unexpected AWS account")
    pipeline = aws("codepipeline", "get-pipeline", {"name": PIPELINE})["pipeline"]
    if args.phase == "inspect":
        running_values(pipeline)
        result = {"configuredKeyNames": list(SECRET_KEYS), "runningValuesMatchPipeline": True, "plannedSecret": SECRET_ID, "plannedCensusParameter": CENSUS_PARAMETER}
    else:
        result = {"store": store_values, "pipeline": update_pipeline, "verify": verify}[args.phase](pipeline)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, KeyError, ValueError, StopIteration, OSError, subprocess.TimeoutExpired) as error:
        # Runtime errors above contain only fixed text, operation names and booleans.
        message = str(error) if isinstance(error, RuntimeError) else type(error).__name__
        raise SystemExit(f"Migration stopped: {message}") from None

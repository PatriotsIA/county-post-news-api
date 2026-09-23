import copy
import importlib.util
import json
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("migration", Path(__file__).parents[2] / "scripts/ops/migrate-provider-secrets.py")
migration = importlib.util.module_from_spec(spec)
spec.loader.exec_module(migration)


def fixture():
    return {"name": migration.PIPELINE, "version": 7, "executionMode": "QUEUED", "stages": [
        {"name": "Source", "actions": [{"actionTypeId": {"provider": "CodeStarSourceConnection"}, "configuration": {"FullRepositoryId": "PatriotsIA/county-post-news-api", "BranchName": "main"}}]},
        {"name": "Deploy", "actions": [{"actionTypeId": {"provider": "CloudFormation"}, "configuration": {"StackName": "county-news-api", "RoleArn": "test-role", "ParameterOverrides": json.dumps({**{key: "fixture-value" for key in migration.SECRET_KEYS}, "EnableEdgeCache": "true", "NewsApiReservedConcurrency": "50", "FeedRefreshMaximumConcurrency": "6", "StripeCheckoutSuccessUrl": "https://example.com/success", "AtlasSourceLocation": "old-repository"})}}]},
    ]}


class SecretMigrationTests(unittest.TestCase):
    def test_removes_credentials_and_preserves_every_other_pipeline_setting(self):
        original = fixture()
        before = copy.deepcopy(original)
        updated = migration.migrated_pipeline(original)
        self.assertEqual(original, before)
        old = json.loads(migration.deploy_action(original)["configuration"]["ParameterOverrides"])
        new = json.loads(migration.deploy_action(updated)["configuration"]["ParameterOverrides"])
        self.assertFalse(set(migration.SECRET_KEYS).intersection(new))
        self.assertEqual(new.pop("AtlasSourceLocation"), migration.SOURCE)
        self.assertEqual(new, {key: value for key, value in old.items() if key not in (*migration.SECRET_KEYS, "AtlasSourceLocation")})
        migration.deploy_action(updated)["configuration"]["ParameterOverrides"] = migration.deploy_action(original)["configuration"]["ParameterOverrides"]
        self.assertEqual(updated, original)

    def test_refuses_unexpected_stack_or_multiple_deploy_actions(self):
        for mutate in [lambda p: migration.deploy_action(p)["configuration"].update(StackName="different-stack"), lambda p: p["stages"].append(copy.deepcopy(p["stages"][-1]))]:
            pipeline = fixture()
            mutate(pipeline)
            with self.assertRaises(RuntimeError):
                migration.migrated_pipeline(pipeline)

    def test_active_deploy_transition_prevents_pipeline_write(self):
        state = {"stageStates": [{"stageName": "Deploy", "inboundTransitionState": {"enabled": True}}]}
        with patch.object(migration, "running_values", return_value=({"a": "b"}, "c")), patch.object(migration, "stored_values", return_value=({"a": "b"}, "c", "arn")), patch.object(migration, "aws", return_value=state) as aws:
            with self.assertRaisesRegex(RuntimeError, "Pause the Deploy"):
                migration.update_pipeline(fixture())
            self.assertEqual([c.args[1] for c in aws.call_args_list], ["get-pipeline-state"])

    def test_mismatched_secure_storage_prevents_any_pipeline_call(self):
        with patch.object(migration, "running_values", return_value=({"a": "old"}, "c")), patch.object(migration, "stored_values", return_value=({"a": "rotated"}, "c", "arn")), patch.object(migration, "aws") as aws:
            with self.assertRaisesRegex(RuntimeError, "does not match"):
                migration.update_pipeline(fixture())
            aws.assert_not_called()

    def test_existing_rotated_secret_is_never_overwritten(self):
        with patch.object(migration, "running_values", return_value=({"a": "old"}, "c")), patch.object(migration, "aws", side_effect=[{"SecretString": '{"a":"rotated"}'}, {"Parameter": {"Type": "SecureString", "Value": "c"}}]) as aws:
            with self.assertRaisesRegex(RuntimeError, "different values"):
                migration.store_values(fixture())
            self.assertEqual([c.args[1] for c in aws.call_args_list], ["get-secret-value", "get-parameter"])

    def test_sensitive_request_uses_private_temporary_file_not_arguments(self):
        paths = []
        def run(command, **kwargs):
            uri = command[command.index("--cli-input-json") + 1]
            file = Path(uri.removeprefix("file://"))
            paths.append(file)
            self.assertEqual(file.stat().st_mode & 0o777, 0o600)
            self.assertEqual(file.parent.stat().st_mode & 0o777, 0o700)
            self.assertEqual(json.loads(file.read_text()), {"SecretString": "fixture-sensitive-value"})
            self.assertNotIn("fixture-sensitive-value", " ".join(command))
            return type("Result", (), {"returncode": 0, "stdout": "{}"})()
        with patch.object(migration.subprocess, "run", side_effect=run):
            migration.aws("secretsmanager", "create-secret", {"SecretString": "fixture-sensitive-value"})
        self.assertFalse(paths[0].exists())


if __name__ == "__main__":
    unittest.main()

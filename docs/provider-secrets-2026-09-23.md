# Provider secrets and Atlas deployment — PIA-007 / PIA-036

The deployment pipeline previously stored USDA, FRED, Stripe, and Census keys in its plaintext `ParameterOverrides`. Atlas also stored its Census key in a plaintext CodeBuild environment variable and cloned the former `ErikBurdett` repository.

The template now resolves the reader's three keys from one JSON secret, `county-news-api/providers`, during CloudFormation deployment. The API keeps the same environment contract and makes no Secrets Manager call while serving a reader. The three keys share a secret because the same reader function already needs all three; Atlas receives no access to this secret.

Atlas uses a separate standard SSM SecureString, `/county-news-api/census-api-key`, loaded by CodeBuild at build start. Its role can read only that parameter. Its source URL is now `https://github.com/PatriotsIA/county-post-news-api.git` in both the template and the pipeline override. Standard SSM parameter storage avoids a second paid Secrets Manager secret. The reader has no new runtime dependency or package.

These are credential-storage changes, not key rotation. Previously exposed keys must still be replaced in their provider accounts. Old pipeline versions or historical build metadata may retain old values until the credentials are retired. Lambda's deployed environment still contains the resolved reader keys, so access to its configuration remains privileged.

## Ordered migration

Use profile `pia`, region `us-east-2`, account `426771918029`. Never print raw pipeline configuration, Lambda environment variables, CodeBuild environment values, or secret contents. The checked-in migration tool emits only names and verification booleans; requests containing values use temporary mode-0600 files in a mode-0700 directory.

1. Run `python3 scripts/ops/migrate-provider-secrets.py inspect`. It compares each pipeline key with the running reader/Atlas value and fails on a mismatch.
2. Run `python3 scripts/ops/migrate-provider-secrets.py store`. It creates the one Secrets Manager secret and one standard SSM SecureString, verifies the saved values, and grants `CountyNewsApiCloudFormationDeployRole` read permission for the exact secret ARN. It refuses to overwrite different existing values. This phase does not change running services.
3. Confirm the current deployment has completed. Temporarily disable the pipeline's **Deploy inbound** transition; readers and refresh workers continue running:

   ```sh
   aws --profile pia --region us-east-2 codepipeline disable-stage-transition --pipeline-name county-news-api-pipeline --stage-name Deploy --transition-type Inbound --reason "PIA-007: coordinate tested secret-reference template and sanitized overrides"
   ```

4. Run `python3 scripts/ops/migrate-provider-secrets.py pipeline`. It verifies storage again, removes only the four credential overrides, updates the Atlas source URL, and confirms all other pipeline settings are preserved. No key values are added to the new pipeline definition. Do not release the former template with these new overrides.
5. Merge the tested template and wait for the matching CodeBuild execution to pass. The pipeline uses `QUEUED` mode: inspect revisions and stop any obsolete queued execution before it reaches Deploy. Re-enable Deploy inbound for the new revision; always restore this transition when the coordinated rollout is ready.
6. After stack success, run `python3 scripts/ops/migrate-provider-secrets.py verify`. Confirm the reader values equal secure storage, the pipeline has no old credential overrides, and Atlas uses the new repository and Parameter Store type.
7. Run a read-only Atlas build smoke that clones the new revision and retrieves a single Census record without publishing a snapshot or emitting its key. Verify live health, weather/economic/market endpoints, and existing alarm routes. Do not create paid Stripe sessions merely to test a storage migration; compare the running Stripe value in memory.

The new default storage identifiers make additional pipeline overrides unnecessary. Preserve the existing checkout destinations, CORS, edge cache, reader reservation, six-worker limit, schedules, retention, and notification routes.

## Rotation and rollback

Create replacement keys through each provider's supported account workflow. Update only the corresponding secret JSON field, preserving the others, and increment `ApiProviderSecretRevision` in the deployment overrides to force CloudFormation to resolve the reader secret again. Verify the updated endpoint before revoking its prior key. Replace the Census SecureString value and verify a new Atlas build before retiring its old key. Do not set arbitrary expiry on credentials while services still depend on them.

Changing a Secrets Manager value alone does **not** refresh the Lambda environment. The revision marker exists for this reason. `verify` compares secure storage with the currently deployed values and will fail until redeployment completes.

For application rollback, keep the secret-reference template and sanitized pipeline; restore only application code. If migration fails before the new deployment, the currently deployed Lambda and Atlas configuration remain usable. Fix IAM/storage/template problems while Deploy is paused, then release the tested revision. Do not reintroduce plaintext pipeline keys or delete working credentials as a shortcut.

## Validation

`python3 -m unittest discover -s tests/ops -p 'test_*.py'` checks that other pipeline settings survive, unknown deployment shapes fail closed, active deployment transitions block writes, mismatched/rotated keys are not overwritten, and sensitive requests never appear in process arguments. It runs in the deployment build alongside the API tests and SAM lint.

References: [CloudFormation Secrets Manager references](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/dynamic-references-secretsmanager.html), [CodeBuild environment variable types](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-properties-codebuild-project-environmentvariable.html), [SSM parameter tiers](https://docs.aws.amazon.com/systems-manager/latest/userguide/parameter-store-advanced-parameters.html), and [Secrets Manager pricing](https://aws.amazon.com/secrets-manager/pricing/).

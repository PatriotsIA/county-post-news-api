# Deployment

This service is intended to deploy from GitHub through an AWS-managed connection, not GitHub Actions.

## AWS Resources

Recommended first deployment:

- AWS CodePipeline with a GitHub source connection.
- AWS CodeBuild using `buildspec.yml`.
- AWS SAM/CloudFormation deployment from the packaged template.
- Lambda Function URL for the public API endpoint.

The SAM template is `template.yaml`. The Lambda handler is `dist/handler.handler`, so the build must run `npm run build` before SAM packaging.

## Pipeline Setup

1. Push this repository to GitHub.
2. In AWS Developer Tools, create or use a GitHub connection.
3. Create a CodePipeline source stage from the GitHub repository and branch.
4. Create a CodeBuild project that uses the included `buildspec.yml`.
5. Set the CodeBuild environment variable `ARTIFACT_BUCKET` to an S3 bucket that CodeBuild can write packaged SAM artifacts into.
6. Add a CloudFormation deploy stage that deploys `packaged.yaml`.

The CodeBuild role needs permission to:

- Read and write the artifact S3 bucket.
- Run CloudFormation change sets.
- Create/update the Lambda function, Lambda Function URL, IAM role, and related logs.

## Environment Variables

Production values can be managed in `template.yaml` or overridden through the AWS deployment process.

Set `CORS_ORIGIN` to the production frontend origin when the frontend domain is final. Use `*` only for early testing.

## Local Verification

Before pushing an initial deploy candidate:

```bash
npm ci
npm run typecheck
npm test
npm run build
```

Optional SAM validation:

```bash
sam validate
sam build
```

## Frontend Configuration

After deployment, copy the Lambda Function URL output into the frontend environment:

```text
VITE_NEWS_API_URL=https://<function-url-id>.lambda-url.<region>.on.aws/
```

The frontend should use page endpoints for initial loads:

- `/v1/pages/national`
- `/v1/pages/states/:stateSlug`
- `/v1/pages/counties/:stateSlug/:countySlug`

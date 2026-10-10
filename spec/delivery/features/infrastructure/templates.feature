@tier:template @awaiting:ENV-02
Feature: Cloud templates meet the security baseline
  The contract is the synthesized CloudFormation, not the code that produced it
  (A-18, DC-002). Policies under policy/ are AWS CloudFormation Guard rules.
  Catalog: cloudwatch-logs, iam-least-privilege, ecs-fargate-tasks, secrets-manager.

  Background:
    Given the CloudFormation templates synthesized for "nonprod" and "prod"

  @CTL-030 @nist:AU-9 @ssdf:PW.9.1 @env:nonprod @env:prod @pillar:observability
  Scenario: Containers log to encrypted log groups that expire
    Then every template passes the "log-groups" policy

  @CTL-031 @nist:AC-6 @ssdf:PW.9.1 @env:nonprod @env:prod @pillar:security
  Scenario: IAM policies allow no wildcard actions
    Then every template passes the "iam-least-privilege" policy

  @CTL-032 @nist:CM-7 @ssdf:PW.9.1 @env:nonprod @env:prod @pillar:security
  Scenario: Containers run on Fargate as non-root with a read-only file system
    Then every template passes the "task-hardening" policy

  @CTL-033 @nist:CM-7 @ssdf:PW.9.1 @env:nonprod @env:prod @pillar:security
  Scenario: Prod never enables test endpoints; non-prod does
    Then no container in the "prod" templates sets PETCLINIC_TEST_ENDPOINTS to "enabled"
    And every backend container in the "nonprod" templates sets PETCLINIC_TEST_ENDPOINTS to "enabled"

  @CTL-034 @nist:IA-5 @ssdf:PW.9.1 @env:nonprod @env:prod @pillar:security
  Scenario: The token secret comes from Secrets Manager
    Then no container receives AUTH_TOKEN_SECRET as a plain environment variable
    And every backend container receives AUTH_TOKEN_SECRET from AWS Secrets Manager

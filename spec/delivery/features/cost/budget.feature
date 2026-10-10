@pillar:cost @awaiting:ENV-02
Feature: Stay under the $25 monthly ceiling
  Decided 2026-10-10. Always-on Fargate tasks, a load balancer per environment, and a
  NAT gateway would each eat most of the budget, so cloud environments are ephemeral:
  created on demand, tested, then torn down: non-prod 15 minutes and prod 30 minutes
  after creation (decided 2026-10-10). Cost is not a NIST
  control, so these scenarios say so explicitly with @nist:none @ssdf:none.
  Catalog: no-nat-gateway, aws-budgets, ephemeral-environments.

  @tier:template @CTL-040 @nist:none @ssdf:none @env:nonprod @env:prod
  Scenario: No NAT gateways
    Given the CloudFormation templates synthesized for "nonprod" and "prod"
    Then no template contains a resource of type "AWS::EC2::NatGateway"

  @tier:template @CTL-041 @nist:none @ssdf:none @env:nonprod @env:prod
  Scenario: A $25 monthly budget alarms before it is spent
    Given the CloudFormation templates synthesized for "org"
    Then an org template defines a monthly cost budget of 25 USD
    And the budget notifies a subscriber at 80 percent of forecasted spend
    And the budget notifies a subscriber at 100 percent of actual spend

  @tier:template @CTL-042 @nist:none @ssdf:none @env:nonprod @env:prod
  Scenario: Every billable environment resource carries a TTL
    Given the CloudFormation templates synthesized for "nonprod" and "prod"
    Then every resource of these types carries the "petclinic:ttl" tag:
      | type                                      |
      | AWS::ECS::Cluster                         |
      | AWS::ECS::Service                         |
      | AWS::ElasticLoadBalancingV2::LoadBalancer |
      | AWS::Logs::LogGroup                       |
      | AWS::EC2::VPC                             |
    And every "petclinic:ttl" tag is a whole number of minutes within the catalog limit for its environment

  @tier:static @CTL-043 @nist:none @ssdf:none @env:nonprod @env:prod
  Scenario: Environments are destroyed when testing ends, with a sweep as backstop
    Given the delivery workflows
    Then every job that deploys to "nonprod" is followed by "infra/destroy nonprod" that runs even if tests fail
    And a scheduled delivery workflow runs "infra/destroy" at least every 5 minutes

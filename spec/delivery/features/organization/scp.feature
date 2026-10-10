@tier:template @pillar:governance @awaiting:ENV-02
Feature: Organization guardrails no account can switch off
  AWS Organizations with service control policies (decided 2026-10-10). The management
  account holds only the organization, SCPs, billing and budgets; non-prod and prod are
  member accounts. SCPs are by-product code like everything else, checked here.
  Catalog: scp-guardrails.

  Background:
    Given the CloudFormation templates synthesized for "org"

  @CTL-050 @nist:CM-5 @ssdf:PO.5.1 @env:nonprod @env:prod
  Scenario: Member accounts cannot leave the organization
    Then an attached SCP denies these actions:
      | action                          |
      | organizations:LeaveOrganization |

  @CTL-051 @nist:AU-9 @ssdf:PO.5.1 @env:nonprod @env:prod
  Scenario: Member accounts cannot switch off audit logging
    Then an attached SCP denies these actions:
      | action                              |
      | cloudtrail:StopLogging              |
      | cloudtrail:DeleteTrail              |
      | config:StopConfigurationRecorder    |
      | config:DeleteConfigurationRecorder  |

  @CTL-052 @nist:CM-7 @ssdf:PO.5.1 @env:nonprod @env:prod
  Scenario: Member accounts work only in the catalog region
    Then an attached SCP denies requests outside the catalog region

@tier:static @pillar:security
Feature: Workflows run with least privilege and pinned dependencies
  Applies to every workflow in .github/workflows, including the human-owned root of
  trust: a rule the humans don't follow is not a rule. Delivery workflows (DC-006) are
  agent-built. Catalog: workflow-hardening, aws-oidc, security-scans, sbom.

  @CTL-010 @nist:AC-6 @ssdf:PO.5.1 @env:nonprod @env:prod
  Scenario: Every workflow defaults to read-only permissions
    Given every GitHub Actions workflow in the repository
    Then each workflow declares top-level permissions
    And no workflow or job grants "write-all"
    And top-level permissions grant no write scope

  @CTL-011 @nist:SR-3 @ssdf:PW.4.1 @env:nonprod @env:prod
  Scenario: Actions from outside this repository are pinned to a full commit SHA
    Given every GitHub Actions workflow in the repository
    Then every external action reference is pinned to a 40-character commit SHA

  @CTL-012 @awaiting:CI-02 @nist:IA-5 @ssdf:PO.5.2 @env:nonprod @env:prod
  Scenario: AWS access uses short-lived OIDC credentials, never stored keys
    Given every GitHub Actions workflow in the repository
    Then no workflow mentions AWS access keys or secret keys
    Given the delivery workflows
    Then at least one job configures AWS credentials
    And every job that configures AWS credentials assumes a role with "id-token: write"

  @CTL-013 @awaiting:CI-02 @nist:RA-5 @ssdf:PW.7.2 @env:nonprod @env:prod
  Scenario: Security scans gate delivery
    Given the delivery workflows
    Then delivery runs each portable security scan:
      | script                  |
      | run-sast.sh             |
      | run-secret-scan.sh      |
      | run-dependency-audit.sh |
    And those scan steps set SECURITY_GATE to "fail"
    And no scan step or its job can continue on error
    And each portable scan script reads SECURITY_GATE

  @CTL-014 @awaiting:CI-02 @nist:CM-8 @ssdf:PS.3.2 @env:nonprod @env:prod
  Scenario: Every image build produces an SBOM
    Given the delivery workflows
    Then at least one job builds a container image
    And every job that builds a container image also generates an SBOM with Syft

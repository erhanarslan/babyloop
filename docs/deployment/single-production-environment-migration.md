# Single-production environment migration note

The former `babyloop-production` GCP project is retired and must never be an active deployment target. It contained no BabyLoop runtime resources and is retained here only as historical identification for billing/project retirement.

The sole physical production project is `babyloop-staging`. Production domain cutover must complete and mandatory public smoke must pass before staging-domain mappings are removed. After cutover evidence is retained, remove billing from the retired project or delete it through the normal audited operator process.

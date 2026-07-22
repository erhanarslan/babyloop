import assert from "node:assert/strict";
import { test } from "node:test";
import {
  policyHasMember,
  RUN_INVOKER_ROLE,
  scheduledJobNames,
  schedulerMember
} from "../cloud-run-iam-lib.mjs";

test("detects only the exact IAM role and scheduler member", () => {
  const member = schedulerMember(
    "scheduler@example.iam.gserviceaccount.com"
  );
  const policy = {
    bindings: [
      {
        role: RUN_INVOKER_ROLE,
        members: [member]
      },
      {
        role: "roles/viewer",
        members: ["user:viewer@example.com"]
      }
    ]
  };

  assert.equal(
    policyHasMember(policy, RUN_INVOKER_ROLE, member),
    true
  );
  assert.equal(
    policyHasMember(
      policy,
      RUN_INVOKER_ROLE,
      "serviceAccount:other@example.iam.gserviceaccount.com"
    ),
    false
  );
});

test("selects notification and reminder jobs but never migration", () => {
  const contract = {
    jobs: {
      migrate: { name: "babyloop-migrate" },
      notification: {
        name: "babyloop-notification-worker",
        schedule: "*/5 * * * *"
      },
      childReminder: {
        name: "babyloop-child-reminder-worker",
        schedule: "*/5 * * * *"
      }
    }
  };

  assert.deepEqual(scheduledJobNames(contract), [
    "babyloop-notification-worker",
    "babyloop-child-reminder-worker"
  ]);
});

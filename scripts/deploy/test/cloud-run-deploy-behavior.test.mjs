import assert from "node:assert/strict";
import { access, readFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
  buildJobDeployArgs,
  buildSchedulerArgs,
  buildSchedulerDescribeArgs,
  buildSchedulerJobIamArgs,
  buildScheduledJobIamPolicyArgs,
  buildScheduledJobStatusArgs,
  buildServiceDeployArgs,
  deploymentPlan,
  executeDeploymentPlan,
  schedulerExists,
  schedulerRunUri,
  validateCloudRunDeploymentContract,
  verifyScheduledJobInfrastructure,
} from "../../gcp/deploy-cloud-run.mjs";
import { assessDeploymentReadiness } from "../deployment-lib.mjs";

async function loadContract() {
  return JSON.parse(
    await readFile(
      "deploy/gcp/cloud-run.contract.json",
      "utf8",
    ),
  );
}

function fixture(contract) {
  return {
    config: contract.jobs.notification,
    key: "notification",
    context: { project: contract.projects.staging },
    contract,
    environment: "staging",
  };
}

function schedulerSnapshot(options, overrides = {}) {
  const schedulerEmail = `babyloop-scheduler-invoker@${options.context.project}.iam.gserviceaccount.com`;
  const httpTargetOverrides = overrides.httpTarget ?? {};
  return {
    name: `projects/${options.context.project}/locations/${options.contract.schedulerRegion}/jobs/${options.config.name}-schedule`,
    state: "ENABLED",
    schedule: options.config.schedule,
    timeZone: options.contract.timezone,
    ...overrides,
    httpTarget: {
      uri: schedulerRunUri(
        options.context.project,
        options.contract.region,
        options.config.name,
      ),
      httpMethod: "POST",
      ...httpTargetOverrides,
      oauthToken: {
        serviceAccountEmail: schedulerEmail,
        ...(httpTargetOverrides.oauthToken ?? {}),
      },
    },
  };
}

function jobIamPolicy(options, includeExpectedMember = true) {
  return {
    bindings: [{
      role: "roles/run.invoker",
      members: includeExpectedMember
        ? [`serviceAccount:babyloop-scheduler-invoker@${options.context.project}.iam.gserviceaccount.com`]
        : ["serviceAccount:unexpected@example.test"],
    }],
  };
}

function verificationExecute(options, {
  includeExpectedIamMember = true,
  schedulerOverrides = {},
} = {}) {
  return async (args) => {
    if (args[0] === "scheduler") {
      return { stdout: JSON.stringify(schedulerSnapshot(options, schedulerOverrides)) };
    }
    if (args.includes("get-iam-policy")) {
      return { stdout: JSON.stringify(jobIamPolicy(options, includeExpectedIamMember)) };
    }
    return {
      stdout: JSON.stringify({
        metadata: { name: options.config.name },
        status: {},
      }),
    };
  };
}

test("Scheduler create and update use their supported header flags", async () => {
  const contract = await loadContract();
  const options = fixture(contract);
  const createArgs = buildSchedulerArgs({ ...options, verb: "create" });
  const updateArgs = buildSchedulerArgs({ ...options, verb: "update" });

  assert.ok(createArgs.includes("--headers=Content-Type=application/json"));
  assert.ok(!createArgs.some((arg) => arg.startsWith("--update-headers=")));
  assert.ok(updateArgs.includes("--update-headers=Content-Type=application/json"));
  assert.ok(!updateArgs.some((arg) => arg.startsWith("--headers=")));
});

test("Scheduler existence is false only for NOT_FOUND", async () => {
  const contract = await loadContract();
  const name = "babyloop-notification-worker-schedule";
  assert.equal(
    await schedulerExists(
      name,
      contract,
      contract.projects.staging,
      async () => {
        throw new Error("NOT_FOUND: Job not found");
      },
    ),
    false,
  );

  for (const message of [
    "PERMISSION_DENIED: missing cloudscheduler.jobs.get",
    "PERMISSION_DENIED: Cloud Scheduler API has not been used or is disabled",
    "ERROR: (gcloud.scheduler.jobs.describe) unrecognized arguments: --bad-flag",
    "INTERNAL: backend transient failure",
  ]) {
    await assert.rejects(
      schedulerExists(
        name,
        contract,
        contract.projects.staging,
        async () => {
          throw new Error(message);
        },
      ),
      new RegExp(message.split(":")[0], "u"),
    );
  }
});

test("Scheduler URI, OAuth identity and job-scoped invoker IAM are exact", async () => {
  const contract = await loadContract();
  const options = fixture(contract);
  const schedulerArgs = buildSchedulerArgs({ ...options, verb: "update" });
  const schedulerDescribeArgs = buildSchedulerDescribeArgs(options);
  const iamArgs = buildSchedulerJobIamArgs(options);
  const schedulerEmail = "babyloop-scheduler-invoker@babyloop-staging.iam.gserviceaccount.com";

  assert.equal(
    schedulerRunUri(
      "babyloop-staging",
      "europe-west1",
      "babyloop-notification-worker",
    ),
    "https://run.googleapis.com/v2/projects/babyloop-staging/locations/europe-west1/jobs/babyloop-notification-worker:run",
  );
  assert.ok(schedulerArgs.includes(`--oauth-service-account-email=${schedulerEmail}`));
  assert.ok(schedulerDescribeArgs.includes(
    "--format=json(name,state,schedule,timeZone,httpTarget.uri,httpTarget.httpMethod,httpTarget.oauthToken.serviceAccountEmail)",
  ));
  assert.ok(iamArgs.includes(`--member=serviceAccount:${schedulerEmail}`));
  assert.ok(iamArgs.includes("--role=roles/run.invoker"));
  assert.deepEqual(iamArgs.slice(0, 4), [
    "run",
    "jobs",
    "add-iam-policy-binding",
    "babyloop-notification-worker",
  ]);
});

test("service and job commands use contract identities, images and runtime entrypoints", async () => {
  const contract = await loadContract();
  validateCloudRunDeploymentContract(contract, "staging");
  const context = { project: contract.projects.staging };
  const serviceArgs = buildServiceDeployArgs({
    config: contract.services.api,
    role: "api",
    image: `registry/api@sha256:${"a".repeat(64)}`,
    environment: "staging",
    context,
    contract,
    envFile: "/tmp/runtime.yaml",
    secrets: "DATABASE_URL=babyloop-database-url:1",
  });
  const jobArgs = buildJobDeployArgs({
    config: contract.jobs.childReminder,
    key: "childReminder",
    image: `registry/api@sha256:${"a".repeat(64)}`,
    environment: "staging",
    context,
    contract,
    jobEnvFile: "/tmp/job-runtime.yaml",
    migrationEnvFile: "/tmp/migration-runtime.yaml",
    secrets: "DATABASE_URL=babyloop-database-url:1",
  });

  assert.ok(serviceArgs.includes("--service-account=babyloop-api-runtime@babyloop-staging.iam.gserviceaccount.com"));
  assert.ok(serviceArgs.includes("--allow-unauthenticated"));
  assert.ok(jobArgs.includes("--service-account=babyloop-jobs-runtime@babyloop-staging.iam.gserviceaccount.com"));
  assert.ok(jobArgs.includes("--command=node"));
  assert.ok(jobArgs.includes("--args=dist/scripts/process-child-reminders.js"));
  assert.ok(jobArgs.includes("--env-vars-file=/tmp/job-runtime.yaml"));
});

test("scheduled infrastructure verification accepts ENABLED scheduler exact fields and job-scoped IAM", async () => {
  const contract = await loadContract();
  const options = {
    ...fixture(contract),
    now: new Date("2026-07-26T20:00:00.000Z"),
  };
  const calls = [];
  const successfulExecute = verificationExecute(options);
  const execute = async (args, executeOptions) => {
    calls.push(args);
    return successfulExecute(args, executeOptions);
  };

  const result = await verifyScheduledJobInfrastructure(options, execute);

  assert.equal(result.job.exists, true);
  assert.equal(result.job.latestCreatedExecution, null);
  assert.equal(result.job.executionObservation, "no_execution_observed_during_deployment_verification");
  assert.equal(result.scheduler.state, "ENABLED");
  assert.equal(result.scheduler.enabledVerified, true);
  assert.equal(result.scheduler.schedule, contract.jobs.notification.schedule);
  assert.equal(result.scheduler.scheduleVerified, true);
  assert.equal(result.scheduler.timeZone, contract.timezone);
  assert.equal(result.scheduler.timeZoneVerified, true);
  assert.equal(result.scheduler.httpMethod, "POST");
  assert.equal(result.scheduler.httpMethodVerified, true);
  assert.equal(result.scheduler.uriVerified, true);
  assert.equal(result.scheduler.oauthServiceAccountVerified, true);
  assert.equal(result.iam.jobScoped, true);
  assert.equal(result.iam.verified, true);
  assert.deepEqual(calls, [
    buildScheduledJobStatusArgs(options),
    buildSchedulerDescribeArgs(options),
    buildScheduledJobIamPolicyArgs(options),
  ]);
  assert.ok(calls.every((args) => !args.includes("execute")));
});

for (const [label, schedulerOverrides, expectedError] of [
  ["PAUSED state", { state: "PAUSED" }, /state verification expected ENABLED/u],
  ["wrong schedule", { schedule: "0 0 * * *" }, /schedule verification failed/u],
  ["wrong timezone", { timeZone: "UTC" }, /time zone verification failed/u],
  ["wrong HTTP method", { httpTarget: { httpMethod: "GET" } }, /HTTP method verification failed/u],
  ["wrong URI", { httpTarget: { uri: "https://example.test/wrong" } }, /URI verification failed/u],
  ["wrong OAuth identity", {
    httpTarget: {
      oauthToken: { serviceAccountEmail: "wrong@example.test" },
    },
  }, /OAuth service account verification failed/u],
]) {
  test(`scheduled infrastructure verification rejects ${label}`, async () => {
    const contract = await loadContract();
    const options = fixture(contract);
    const baseExecute = verificationExecute(options, { schedulerOverrides });
    let schedulerAttempts = 0;
    const sleepCalls = [];
    const execute = async (args, executeOptions) => {
      if (args[0] === "scheduler") schedulerAttempts += 1;
      return baseExecute(args, executeOptions);
    };

    await assert.rejects(
      verifyScheduledJobInfrastructure(options, execute, {
        sleep: async (milliseconds) => sleepCalls.push(milliseconds),
      }),
      expectedError,
    );
    assert.equal(schedulerAttempts, 4);
    assert.deepEqual(sleepCalls, [500, 500, 500]);
  });
}

test("scheduled infrastructure verification rejects missing job-scoped IAM", async () => {
  const contract = await loadContract();
  const options = fixture(contract);
  const sleepCalls = [];
  await assert.rejects(
    verifyScheduledJobInfrastructure(
      options,
      verificationExecute(options, { includeExpectedIamMember: false }),
      { sleep: async (milliseconds) => sleepCalls.push(milliseconds) },
    ),
    /missing job-scoped roles\/run\.invoker/u,
  );
  assert.deepEqual(sleepCalls, [500, 500, 500]);
});

test("scheduled infrastructure read-back retries only NOT_FOUND and expected-state propagation", async () => {
  const contract = await loadContract();
  const options = fixture(contract);
  const baseExecute = verificationExecute(options);
  let schedulerAttempts = 0;
  let iamAttempts = 0;
  const sleepCalls = [];
  const execute = async (args, executeOptions) => {
    if (args[0] === "scheduler") {
      schedulerAttempts += 1;
      if (schedulerAttempts === 1) throw new Error("NOT_FOUND: scheduler propagation pending");
      if (schedulerAttempts === 2) {
        return {
          stdout: JSON.stringify(schedulerSnapshot(options, { schedule: "0 0 * * *" })),
        };
      }
    }
    if (args.includes("get-iam-policy")) {
      iamAttempts += 1;
      if (iamAttempts === 1) throw new Error("NOT_FOUND: IAM policy propagation pending");
      if (iamAttempts === 2) {
        return { stdout: JSON.stringify(jobIamPolicy(options, false)) };
      }
    }
    return baseExecute(args, executeOptions);
  };

  const result = await verifyScheduledJobInfrastructure(options, execute, {
    sleep: async (milliseconds) => sleepCalls.push(milliseconds),
  });

  assert.equal(result.scheduler.enabledVerified, true);
  assert.equal(result.iam.verified, true);
  assert.equal(schedulerAttempts, 3);
  assert.equal(iamAttempts, 3);
  assert.deepEqual(sleepCalls, [500, 500, 500, 500]);
});

for (const [label, message, expectedError] of [
  ["permission denied", "PERMISSION_DENIED: cloudscheduler.jobs.get", /PERMISSION_DENIED/u],
  ["disabled API", "PERMISSION_DENIED: Cloud Scheduler API has not been used or is disabled", /API has not been used or is disabled/u],
  ["malformed CLI arguments", "ERROR: unrecognized arguments: --bad-flag", /unrecognized arguments/u],
  ["authentication failure", "UNAUTHENTICATED: invalid authentication credentials", /UNAUTHENTICATED/u],
  ["internal error", "INTERNAL: backend transient failure", /INTERNAL/u],
]) {
  test(`scheduled infrastructure read-back does not retry ${label}`, async () => {
    const contract = await loadContract();
    const options = fixture(contract);
    const baseExecute = verificationExecute(options);
    let schedulerAttempts = 0;
    const sleepCalls = [];
    const execute = async (args, executeOptions) => {
      if (args[0] === "scheduler") {
        schedulerAttempts += 1;
        throw new Error(message);
      }
      return baseExecute(args, executeOptions);
    };

    await assert.rejects(
      verifyScheduledJobInfrastructure(options, execute, {
        sleep: async (milliseconds) => sleepCalls.push(milliseconds),
      }),
      expectedError,
    );
    assert.equal(schedulerAttempts, 1);
    assert.deepEqual(sleepCalls, []);
  });
}

test("deployment phases select migration or services without overlap", async () => {
  const contract = await loadContract();
  assert.deepEqual(
    deploymentPlan(contract, "migration").jobs.map(([key]) => key),
    ["migrate"],
  );
  const services = deploymentPlan(contract, "services");
  assert.deepEqual(services.services.map(([key]) => key), ["api", "web", "backoffice"]);
  assert.deepEqual(services.jobs.map(([key]) => key), ["notification", "childReminder"]);
});

test("partial deployment failures never call receipt completion", async () => {
  let receiptWritten = false;
  await assert.rejects(
    executeDeploymentPlan({
      plan: {
        services: [["api", { name: "babyloop-api" }]],
        jobs: [
          ["notification", { name: "babyloop-notification-worker", schedule: "*/5 * * * *" }],
          ["childReminder", { name: "babyloop-child-reminder-worker", schedule: "*/5 * * * *" }],
        ],
      },
      deployServiceOperation: async () => "https://api.example.test",
      deployJobOperation: async () => {},
      grantSchedulerOperation: async () => {},
      upsertSchedulerOperation: async (key) => {
        if (key === "childReminder") throw new Error("child reminder scheduler failed");
        return { verified: true };
      },
      onComplete: async () => {
        receiptWritten = true;
      },
    }),
    /child reminder scheduler failed/u,
  );
  assert.equal(receiptWritten, false);
});

test("deployment completion passes exact service URLs to receipt creation", async () => {
  let receiptUrls;
  await executeDeploymentPlan({
    plan: {
      services: [
        ["api", {}],
        ["web", {}],
        ["backoffice", {}],
      ],
      jobs: [],
    },
    deployServiceOperation: async (key) => `https://${key}.run.app`,
    deployJobOperation: async () => {},
    grantSchedulerOperation: async () => {},
    upsertSchedulerOperation: async () => {},
    onComplete: async ({ urls }) => {
      receiptUrls = urls;
    },
  });
  assert.deepEqual(receiptUrls, {
    api: "https://api.run.app",
    web: "https://web.run.app",
    backoffice: "https://backoffice.run.app",
  });
});

test("scheduled deploy order is job, job-scoped IAM, scheduler verification and receipt", async () => {
  const operations = [];
  await executeDeploymentPlan({
    plan: {
      services: [],
      jobs: [[
        "childReminder",
        {
          name: "babyloop-child-reminder-worker",
          schedule: "*/5 * * * *",
        },
      ]],
    },
    deployServiceOperation: async () => {},
    deployJobOperation: async () => operations.push("deploy"),
    grantSchedulerOperation: async () => operations.push("iam"),
    upsertSchedulerOperation: async () => {
      operations.push("scheduler");
      return { verified: true };
    },
    onComplete: async () => operations.push("receipt"),
  });
  assert.deepEqual(operations, [
    "deploy",
    "iam",
    "scheduler",
    "receipt",
  ]);
});

test("deployment plan contains no business worker execution path", async () => {
  const source = await readFile("scripts/gcp/deploy-cloud-run.mjs", "utf8");
  assert.doesNotMatch(source, /buildJobExecutionArgs|executeScheduledJob|jobs["',\s]+execute/u);
});

test("staging smoke grants bounded bootstrap grace only when no execution was observed during deployment verification", () => {
  const now = new Date("2026-07-26T20:03:00.000Z");
  const readiness = {
    ready: false,
    dependencies: {
      database: { required: true, status: "ready" },
      childReminderWorker: { required: true, status: "failed", code: "WORKER_HEARTBEAT_MISSING" },
    },
  };
  const infrastructure = {
    job: {
      exists: true,
      latestCreatedExecution: null,
      executionObservation: "no_execution_observed_during_deployment_verification",
    },
    scheduler: {
      exists: true,
      enabledVerified: true,
      scheduleVerified: true,
      timeZoneVerified: true,
      httpMethodVerified: true,
      uriVerified: true,
      oauthServiceAccountVerified: true,
    },
    iam: { jobScoped: true, verified: true },
  };
  const deploymentReceipt = {
    kind: "gcp_cloud_run_deployment",
    status: "deployed",
    environment: "staging",
    phase: "services",
    createdAt: "2026-07-26T20:00:00.000Z",
    scheduledInfrastructure: { childReminder: infrastructure },
  };

  const bootstrap = assessDeploymentReadiness(readiness, {
    bootstrapGraceSeconds: 360,
    deploymentReceipt,
    environment: "staging",
    now,
  });
  assert.equal(bootstrap.ready, true);
  assert.equal(bootstrap.bootstrapGrace, true);
  assert.deepEqual(bootstrap.blockingDependencies, ["childReminderWorker"]);

  const afterExecution = assessDeploymentReadiness(readiness, {
    bootstrapGraceSeconds: 360,
    deploymentReceipt: {
      ...deploymentReceipt,
      scheduledInfrastructure: {
        childReminder: {
          ...infrastructure,
          job: {
            exists: true,
            latestCreatedExecution: { name: "child-reminder-execution" },
            executionObservation: "execution_observed_during_deployment_verification",
          },
        },
      },
    },
    environment: "staging",
    now,
  });
  assert.equal(afterExecution.ready, false);
  assert.equal(afterExecution.bootstrapGrace, false);

  const failedHeartbeat = assessDeploymentReadiness({
    ...readiness,
    dependencies: {
      ...readiness.dependencies,
      childReminderWorker: {
        required: true,
        status: "failed",
        code: "WORKER_LAST_RUN_FAILED",
      },
    },
  }, {
    bootstrapGraceSeconds: 360,
    deploymentReceipt,
    environment: "staging",
    now,
  });
  assert.equal(failedHeartbeat.ready, false);
  assert.equal(failedHeartbeat.bootstrapGrace, false);

  const anotherRequiredDependencyFailed = assessDeploymentReadiness({
    ...readiness,
    dependencies: {
      ...readiness.dependencies,
      storage: {
        required: true,
        status: "failed",
        code: "STORAGE_UNAVAILABLE",
      },
    },
  }, {
    bootstrapGraceSeconds: 360,
    deploymentReceipt,
    environment: "staging",
    now,
  });
  assert.equal(anotherRequiredDependencyFailed.ready, false);
  assert.equal(anotherRequiredDependencyFailed.bootstrapGrace, false);

  const wrongEnvironmentReceipt = assessDeploymentReadiness(readiness, {
    bootstrapGraceSeconds: 360,
    deploymentReceipt: {
      ...deploymentReceipt,
      environment: "production",
    },
    environment: "staging",
    now,
  });
  assert.equal(wrongEnvironmentReceipt.ready, false);
  assert.equal(wrongEnvironmentReceipt.bootstrapGrace, false);

  for (const verificationField of [
    "enabledVerified",
    "scheduleVerified",
    "timeZoneVerified",
    "httpMethodVerified",
    "uriVerified",
    "oauthServiceAccountVerified",
  ]) {
    const missingSchedulerVerification = assessDeploymentReadiness(readiness, {
      bootstrapGraceSeconds: 360,
      deploymentReceipt: {
        ...deploymentReceipt,
        scheduledInfrastructure: {
          childReminder: {
            ...infrastructure,
            scheduler: {
              ...infrastructure.scheduler,
              [verificationField]: false,
            },
          },
        },
      },
      environment: "staging",
      now,
    });
    assert.equal(missingSchedulerVerification.ready, false, `${verificationField} must be required`);
    assert.equal(missingSchedulerVerification.bootstrapGrace, false);
  }

  const afterGrace = assessDeploymentReadiness(readiness, {
    bootstrapGraceSeconds: 360,
    deploymentReceipt,
    environment: "staging",
    now: new Date("2026-07-26T20:06:01.000Z"),
  });
  assert.equal(afterGrace.ready, false);
  assert.equal(afterGrace.bootstrapGrace, false);
});

test("production smoke never grants worker bootstrap grace, including a positive override", () => {
  const readiness = {
    ready: false,
    dependencies: {
      database: { required: true, status: "ready" },
      childReminderWorker: {
        required: true,
        status: "failed",
        code: "WORKER_HEARTBEAT_MISSING",
      },
    },
  };
  const deploymentReceipt = {
    kind: "gcp_cloud_run_deployment",
    status: "deployed",
    environment: "production",
    phase: "services",
    createdAt: "2026-07-26T20:00:00.000Z",
    scheduledInfrastructure: {
      childReminder: {
        job: {
          exists: true,
          latestCreatedExecution: null,
          executionObservation: "no_execution_observed_during_deployment_verification",
        },
        scheduler: {
          exists: true,
          enabledVerified: true,
          scheduleVerified: true,
          timeZoneVerified: true,
          httpMethodVerified: true,
          uriVerified: true,
          oauthServiceAccountVerified: true,
        },
        iam: { jobScoped: true, verified: true },
      },
    },
  };
  const options = {
    deploymentReceipt,
    environment: "production",
    now: new Date("2026-07-26T20:03:00.000Z"),
  };

  for (const bootstrapGraceSeconds of [0, 360]) {
    const assessment = assessDeploymentReadiness(readiness, {
      ...options,
      bootstrapGraceSeconds,
    });
    assert.equal(assessment.ready, false);
    assert.equal(assessment.bootstrapGrace, false);
  }
});

test("post-deploy smoke defaults worker bootstrap grace to staging only", async () => {
  const source = await readFile("scripts/deploy/post-deploy-smoke.mjs", "utf8");
  assert.match(source, /environment === "staging" \? 360 : 0/u);
});

test("a clean API package build emits every Cloud Run job entrypoint copied into the image", async () => {
  const contract = await loadContract();
  await rm("apps/api/dist", { recursive: true, force: true });
  const build = spawnSync(
    "pnpm",
    ["--filter", "@babyloop/api", "build"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      timeout: 120_000,
    },
  );
  assert.equal(build.status, 0, `${build.stdout}\n${build.stderr}`);
  for (const config of Object.values(contract.jobs)) {
    await access(`apps/api/${config.script}`);
  }
  const dockerfile = await readFile("deploy/docker/Dockerfile", "utf8");
  assert.match(dockerfile, /cp -R apps\/api\/dist \/out\/api\/dist/u);
});

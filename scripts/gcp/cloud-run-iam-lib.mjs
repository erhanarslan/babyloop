#!/usr/bin/env node

export const RUN_INVOKER_ROLE = "roles/run.invoker";

export function policyHasMember(policy, role, member) {
  return (policy?.bindings || []).some(
    (binding) =>
      binding?.role === role &&
      Array.isArray(binding.members) &&
      binding.members.includes(member)
  );
}

export function scheduledJobEntries(contract) {
  return Object.entries(contract.jobs || {}).filter(
    ([, config]) => Boolean(config?.schedule)
  );
}

export function scheduledJobNames(contract) {
  return scheduledJobEntries(contract).map(([, config]) => config.name);
}

export function schedulerMember(email) {
  return `serviceAccount:${email}`;
}

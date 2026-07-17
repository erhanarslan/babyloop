# Analytics Privacy and Data Handling

BabyLoop product analytics is first-party, privacy-minimized, and separate from admin audit logs.

The system does not perform advertising tracking, third-party cross-site tracking, keyboard capture, DOM capture, or session replay.

Anonymous ids are hashed server-side. Exact IP addresses, raw user agents, raw referrer URLs, raw query strings, free-text messages, child note/reminder text, assistant prompts, raw source text, signed URLs, and tokens are not stored in analytics properties.

Analytics opt-out can disable non-essential client product events. Security/audit records remain separate and governed by audit retention requirements.

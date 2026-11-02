# AI Study Assistant v0.4 — implementation plan

Status: development branch; **not deployed**.

## Student experience
1. Open Study Hub and choose a class.
2. Choose scope: all class materials, one folder, or individually selected notes/files.
3. Generate a guide with key concepts, definitions, explanations, examples, and a source list.
4. Save the guide in the family's workspace; allow parent and student accounts to read it.
5. Follow up with multiple-choice and short-answer practice, explanations, and progress history.

## Privacy and safety
- Never put an AI provider API key in Vite variables or browser JavaScript.
- Call the AI provider from a server-side Supabase Edge Function with a server-side secret.
- Authenticate each request and independently verify family membership and material IDs.
- Only retrieve files in the requester's family. Never use service-role access without explicit family checks.
- Treat uploaded content as untrusted instructions. Limit input sizes, requests, and generated output.
- Display that AI-generated answers can be inaccurate and require review.
- Never send student data to an AI provider without informed family approval.

## Phased implementation
1. Material selection UI and family-authorized content retrieval.
2. AI study guide generation with text extraction for PDFs and images, using a supported multimodal model.
3. Saved guides and practice quizzes.
4. Quiz scoring and parent-visible progress.

## Configuration required
- Select an AI provider and obtain an API key under the family's account.
- Store key only as a Supabase Edge Function secret, not in GitHub or Vercel public environment variables.
- Agree on reasonable spending limits and document handling before enabling generation.

## Release checks
- Student and both parents can generate and read shared guides.
- Another family cannot read source material or generated guides.
- Oversized/malformed uploads and provider failures show clear errors.
- Preview passes before merging into main.

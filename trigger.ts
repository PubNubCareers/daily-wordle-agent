import 'dotenv/config';
import { TaskClient, textPart, decodeInlineArtifact } from '@blocks-network/sdk';
import type { ArtifactEvent, ProgressEvent, TerminalEvent } from '@blocks-network/sdk';

async function main() {
  const client = await TaskClient.create({
    billingMode: 'free',
    apiKey: process.env.BLOCKS_API_KEY!,
  });

  const payload = {
    action: 'start',
  };

  const session = await client.sendMessage({
    agentName: 'daily_wordle_agent',
    requestParts: [textPart(JSON.stringify(payload), 'request')],
  });

  console.log('Task created:', session.taskId);

  session.onProgress((event: ProgressEvent) => {
    console.log('[progress]', event.message ?? event.progress ?? '');
  });

  session.onArtifact(async (event: ArtifactEvent) => {
    const ref = event.artifactRef;
    if (ref.kind === 'inline' && ref.data) {
      const bytes = decodeInlineArtifact(ref);
      console.log('[artifact]', new TextDecoder().decode(bytes));
      return;
    }

    const downloaded = await session.downloadArtifact(ref);
    console.log('[artifact]', new TextDecoder().decode(downloaded.data));
  });

  session.onTerminal((_event: TerminalEvent) => {
    console.log('[done] Task complete');
    session.close();
    client.destroy();
    process.exit(0);
  });
}

main().catch(console.error);

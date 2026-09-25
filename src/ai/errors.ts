/** A friendly error: `message` is written for the author, never a stack trace. */
export class AIError extends Error {
  constructor(
    message: string,
    public kind: 'no-key' | 'bad-key' | 'network' | 'busy' | 'quota' | 'too-long' | 'cancelled' | 'other',
  ) {
    super(message);
  }
}

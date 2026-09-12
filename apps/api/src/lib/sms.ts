import type { FastifyBaseLogger } from 'fastify';
import { getConfig } from '../config.js';

/**
 * Sending the one-time code.
 *
 * Behind an interface because the gateway is the part of this system most
 * likely to be dictated by whoever signs the procurement: MSG91 today, a NIC
 * SMS gateway or Gupshup tomorrow. Nothing above this line should have to change.
 */
export interface SmsProvider {
  readonly name: string;
  sendOtp(phone: string, code: string, ttlSeconds: number): Promise<void>;
}

/**
 * Development and test only.
 *
 * `loadConfig` refuses to start a production process with this provider
 * selected, because writing a live credential to an application log is exactly
 * the sort of thing that survives into production by accident.
 */
class ConsoleSmsProvider implements SmsProvider {
  readonly name = 'console';
  constructor(private readonly logger: FastifyBaseLogger | Console = console) {}

  async sendOtp(phone: string, code: string, ttlSeconds: number): Promise<void> {
    this.logger.info(
      { phone, code, ttlSeconds },
      'One-time code (console provider — never enabled in production)',
    );
  }
}

class Msg91SmsProvider implements SmsProvider {
  readonly name = 'msg91';

  constructor(
    private readonly authKey: string,
    private readonly templateId: string,
    private readonly senderId: string | undefined,
    private readonly logger: FastifyBaseLogger | Console,
  ) {}

  async sendOtp(phone: string, code: string, ttlSeconds: number): Promise<void> {
    const body = {
      template_id: this.templateId,
      short_url: '0',
      recipients: [
        {
          // MSG91 expects the number without the leading '+'.
          mobiles: phone.replace(/^\+/, ''),
          otp: code,
          ttl: String(Math.round(ttlSeconds / 60)),
        },
      ],
      ...(this.senderId ? { sender: this.senderId } : {}),
    };

    const response = await fetch('https://control.msg91.com/api/v5/flow/', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authkey: this.authKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      // The code itself is never logged, only the failure.
      this.logger.error(
        { status: response.status, detail: detail.slice(0, 300) },
        'SMS gateway rejected the request',
      );
      throw new Error(`SMS gateway responded ${response.status}`);
    }
  }
}

let provider: SmsProvider | null = null;

export function getSmsProvider(logger: FastifyBaseLogger | Console = console): SmsProvider {
  if (provider) return provider;
  const config = getConfig();
  if (config.isTest) {
    // The test suite reads the code from the response body; writing it to the
    // console as well would drown the output.
    provider = { name: 'test', async sendOtp() {} };
    return provider;
  }
  provider =
    config.SMS_PROVIDER === 'msg91'
      ? new Msg91SmsProvider(
          config.MSG91_AUTH_KEY ?? '',
          config.MSG91_TEMPLATE_ID ?? '',
          config.MSG91_SENDER_ID,
          logger,
        )
      : new ConsoleSmsProvider(logger);
  return provider;
}

/** Test helper: swap in a recording provider. */
export function setSmsProvider(next: SmsProvider | null): void {
  provider = next;
}

import QRCode from "qrcode";
import whatsappWeb from "whatsapp-web.js";

const { Client, LocalAuth } = whatsappWeb;

export type WhatsappWebStatus = {
  state: "disabled" | "starting" | "qr_pending" | "authenticated" | "connected" | "disconnected" | "error";
  qrDataUrl: string | null;
  phoneNumber: string | null;
  lastConnectedAt: string | null;
  lastError: string | null;
};

class WhatsappWebGateway {
  private client: InstanceType<typeof Client> | null = null;
  private starting: Promise<void> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionallyStopped = false;
  private status: WhatsappWebStatus = {
    state: process.env.WHATSAPP_WEB_ENABLED === "false" ? "disabled" : "disconnected",
    qrDataUrl: null,
    phoneNumber: null,
    lastConnectedAt: null,
    lastError: null,
  };

  getStatus(): WhatsappWebStatus {
    return { ...this.status };
  }

  async start(): Promise<void> {
    if (process.env.WHATSAPP_WEB_ENABLED === "false") {
      this.status.state = "disabled";
      throw new Error("WhatsApp Web is disabled by WHATSAPP_WEB_ENABLED=false");
    }
    if (this.status.state === "connected" || this.status.state === "qr_pending") return;
    if (this.starting) return this.starting;
    this.intentionallyStopped = false;

    this.starting = this.initializeClient()
      .catch(error => {
        this.status.state = "error";
        this.status.lastError = error?.message || String(error);
        this.scheduleReconnect();
        throw error;
      })
      .finally(() => { this.starting = null; });
    return this.starting;
  }

  private async initializeClient(): Promise<void> {
    if (this.client) {
      await this.client.destroy().catch(() => undefined);
    }

    this.status = { ...this.status, state: "starting", qrDataUrl: null, lastError: null };
    const authPath = process.env.WHATSAPP_AUTH_PATH || `${process.cwd()}/.whatsapp-auth`;
    const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH || undefined;

    const client = new Client({
      authStrategy: new LocalAuth({ clientId: "dairyflow-super-admin", dataPath: authPath }),
      puppeteer: {
        headless: true,
        executablePath,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      },
    });
    this.client = client;

    client.on("qr", async (qr: string) => {
      this.status.state = "qr_pending";
      this.status.qrDataUrl = await QRCode.toDataURL(qr, { width: 320, margin: 1 });
      this.status.lastError = null;
    });
    client.on("authenticated", () => {
      this.status.state = "authenticated";
      this.status.qrDataUrl = null;
    });
    client.on("ready", () => {
      this.status.state = "connected";
      this.status.qrDataUrl = null;
      this.status.phoneNumber = client.info?.wid?.user || null;
      this.status.lastConnectedAt = new Date().toISOString();
      this.status.lastError = null;
    });
    client.on("auth_failure", (message: string) => {
      this.status.state = "error";
      this.status.lastError = message || "WhatsApp authentication failed";
    });
    client.on("disconnected", (reason: string) => {
      this.status.state = "disconnected";
      this.status.qrDataUrl = null;
      this.status.lastError = reason || null;
      this.scheduleReconnect();
    });

    await client.initialize();
  }

  private scheduleReconnect() {
    if (this.intentionallyStopped || process.env.WHATSAPP_WEB_ENABLED === "false" || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.start().catch(error => console.error("WhatsApp Web reconnect failed:", error));
    }, 15000);
  }

  async sendText(phone: string, message: string): Promise<string> {
    if (!this.client || this.status.state !== "connected") {
      throw new Error("WhatsApp Web is not connected");
    }
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 15) {
      throw new Error(`Invalid WhatsApp phone number: ${phone}`);
    }
    const chatId = `${digits}@c.us`;
    const registered = await this.client.isRegisteredUser(chatId);
    if (!registered) throw new Error(`Phone number is not registered on WhatsApp: ${phone}`);
    const result = await this.client.sendMessage(chatId, message);
    return result.id?._serialized || result.id?.id || "sent";
  }

  async logout(): Promise<void> {
    this.intentionallyStopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    if (this.client) {
      await this.client.logout().catch(() => undefined);
      await this.client.destroy().catch(() => undefined);
    }
    this.client = null;
    this.status = {
      state: "disconnected",
      qrDataUrl: null,
      phoneNumber: null,
      lastConnectedAt: null,
      lastError: null,
    };
  }
}

export const whatsappWebGateway = new WhatsappWebGateway();

/**
 * IronFist Web & Node.js Hardware Trait Collector SDK
 */

export interface IronFistClientOptions {
  gatewayUrl?: string;
  apiKey: string;
}

export class IronFistClient {
  private gatewayUrl: string;
  private apiKey: string;

  constructor(options: IronFistClientOptions) {
    this.gatewayUrl = options.gatewayUrl || 'http://localhost:8080';
    this.apiKey = options.apiKey;
  }

  /**
   * Extracts client hardware signals from browser environment.
   */
  public async collectTraits(): Promise<Record<string, any>> {
    if (typeof window === 'undefined') {
      // Node.js Environment
      return {
        os_platform: process.platform,
        os_version: process.version,
        cpu_cores: require('os').cpus()?.length || 4,
        memory_gb: Math.round(require('os').totalmem() / (1024 * 1024 * 1024)),
      };
    }

    // Browser Environment
    const canvasHash = this.getCanvasHash();
    const webglHash = this.getWebGLRenderer();

    return {
      os_platform: navigator.platform || 'web',
      os_version: navigator.userAgent,
      cpu_cores: navigator.hardwareConcurrency || 4,
      memory_gb: (navigator as any).deviceMemory || 8,
      gpu_renderer: webglHash,
      screen_resolution: `${window.screen.width}x${window.screen.height}`,
      color_depth: window.screen.colorDepth || 24,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      canvas_hash: canvasHash,
      webgl_hash: webglHash,
    };
  }

  /**
   * Verifies free trial eligibility against IronFist Edge Gateway.
   */
  public async verifyTrial(accountId: string, requireNoVpn = false) {
    const traits = await this.collectTraits();
    const response = await fetch(`${this.gatewayUrl}/v1/verify-trial`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-IronFist-Key': this.apiKey,
      },
      body: JSON.stringify({
        api_key: this.apiKey,
        account_id: accountId,
        hardware_traits: traits,
        require_no_vpn: requireNoVpn,
      }),
    });

    return await response.json();
  }

  private getCanvasHash(): string {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return '';
      canvas.width = 200;
      canvas.height = 50;
      ctx.textBaseline = 'top';
      ctx.font = "14px 'Arial'";
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.fillText('IronFist Anti-Abuse 👊', 2, 15);
      return canvas.toDataURL().slice(-32);
    } catch {
      return '';
    }
  }

  private getWebGLRenderer(): string {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) return '';
      const debugInfo = (gl as any).getExtension('WEBGL_debug_renderer_info');
      if (!debugInfo) return '';
      return (gl as any).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';
    } catch {
      return '';
    }
  }
}

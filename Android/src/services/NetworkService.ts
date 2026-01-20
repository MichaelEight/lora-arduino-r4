/**
 * Network service for sending GPS data over TCP/WiFi.
 */

import TcpSocket from 'react-native-tcp-socket';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected';

export interface NetworkServiceCallbacks {
  onStateChange?: (state: ConnectionState) => void;
  onError?: (error: string) => void;
}

class NetworkService {
  private socket: ReturnType<typeof TcpSocket.createConnection> | null = null;
  private callbacks: NetworkServiceCallbacks = {};
  private serverIp: string = '';
  private serverPort: number = 5555;

  setCallbacks(callbacks: NetworkServiceCallbacks): void {
    this.callbacks = callbacks;
  }

  private emitState(state: ConnectionState): void {
    this.callbacks.onStateChange?.(state);
  }

  private emitError(error: string): void {
    this.callbacks.onError?.(error);
  }

  async connect(ip: string, port: number = 5555): Promise<boolean> {
    return new Promise((resolve) => {
      this.serverIp = ip;
      this.serverPort = port;
      this.emitState('connecting');

      try {
        this.socket = TcpSocket.createConnection(
          { host: ip, port: port },
          () => {
            this.emitState('connected');
            resolve(true);
          }
        );

        this.socket.on('error', (error) => {
          this.emitError(error.message);
          this.emitState('disconnected');
          this.socket = null;
          resolve(false);
        });

        this.socket.on('close', () => {
          this.emitState('disconnected');
          this.socket = null;
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Connection failed';
        this.emitError(message);
        this.emitState('disconnected');
        resolve(false);
      }
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.emitState('disconnected');
  }

  sendGpsData(data: object): boolean {
    if (!this.socket) {
      return false;
    }

    try {
      const json = JSON.stringify(data) + '\n';
      this.socket.write(json);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Send failed';
      this.emitError(message);
      return false;
    }
  }

  isConnected(): boolean {
    return this.socket !== null;
  }

  getServerAddress(): string {
    return `${this.serverIp}:${this.serverPort}`;
  }
}

export const networkService = new NetworkService();

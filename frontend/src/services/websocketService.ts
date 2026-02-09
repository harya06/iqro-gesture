import { 
  WSMessage, 
  WSResponse, 
  LandmarkArray,
  DEFAULT_CONFIG 
} from '../types';

type MessageHandler = (response: WSResponse) => void;
type ConnectionHandler = (connected: boolean) => void;

class WebSocketService {
  private socket: WebSocket | null = null;
  private sessionId: string;
  private messageHandlers: Set<MessageHandler> = new Set();
  private connectionHandlers: Set<ConnectionHandler> = new Set();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectTimeout: number | null = null;
  private isManualDisconnect: boolean = false;

  constructor() {
    this.sessionId = this.generateSessionId();
  }

  private generateSessionId(): string {
    return 'session_' + Math.random().toString(36).substring(2, 15) + 
           Date.now().toString(36);
  }

  public connect(wsUrl?: string): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    this.isManualDisconnect = false;
    const url = wsUrl || `${DEFAULT_CONFIG.wsUrl}/${this.sessionId}`;
    
    console.log(`Connecting to WebSocket: ${url}`);
    
    try {
      this.socket = new WebSocket(url);
      
      this.socket.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        this.notifyConnectionHandlers(true);
      };
      
      this.socket.onclose = (event) => {
        console.log(`WebSocket closed: ${event.code} - ${event.reason}`);
        this.notifyConnectionHandlers(false);
        
        if (!this.isManualDisconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      };
      
      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
      this.socket.onmessage = (event) => {
        try {
          const response: WSResponse = JSON.parse(event.data);
          this.notifyMessageHandlers(response);
        } catch (e) {
          console.error('Error parsing WebSocket message:', e);
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      this.notifyConnectionHandlers(false);
    }
  }

  public disconnect(): void {
    this.isManualDisconnect = true;
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    
    this.notifyConnectionHandlers(false);
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    
    console.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    this.reconnectTimeout = window.setTimeout(() => {
      this.connect();
    }, delay);
  }

  public sendLandmarks(sequence: LandmarkArray[][]): void {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      return;
    }

    const message: WSMessage = {
      type: 'landmarks',
      data: {
        sequence,
        timestamp: Date.now()
      }
    };

    this.socket.send(JSON.stringify(message));
  }

  public sendPing(): void {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      return;
    }

    this.socket.send(JSON.stringify({ type: 'ping', data: {} }));
  }

  public onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  public onConnectionChange(handler: ConnectionHandler): () => void {
    this.connectionHandlers.add(handler);
    return () => this.connectionHandlers.delete(handler);
  }

  private notifyMessageHandlers(response: WSResponse): void {
    this.messageHandlers.forEach(handler => {
      try {
        handler(response);
      } catch (e) {
        console.error('Error in message handler:', e);
      }
    });
  }

  private notifyConnectionHandlers(connected: boolean): void {
    this.connectionHandlers.forEach(handler => {
      try {
        handler(connected);
      } catch (e) {
        console.error('Error in connection handler:', e);
      }
    });
  }

  public isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  public getSessionId(): string {
    return this.sessionId;
  }
}

// Export singleton instance
export const websocketService = new WebSocketService();
export default websocketService;
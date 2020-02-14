import { Transport } from './transport';
import WebSocket = require('ws');

export class WebsocketTransport extends Transport<{ url: string }> {
    private socket: WebSocket;

    connect(): void {
        this.socket = new WebSocket(this.options.url);
        this.socket.on('open', () => this.callbacks.connect());
        this.socket.on('message', (data: Buffer) => this.callbacks.data(data));
        this.socket.on('close', () => this.callbacks.disconnect());
        this.socket.on('error', (e: Error) => this.callbacks.error(e));
    }

    send(data: Buffer): void {
        this.socket.send(data);
    }
}

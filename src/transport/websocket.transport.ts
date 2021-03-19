import { Transport } from './transport';
import * as WebSocket from 'ws';
import { ClientOptions } from 'ws';
import { Duplex } from 'stream';
import { IllegalStateError } from '../errors';

export interface WebsocketTransportOptions {
    url: string;
    additionalOptions?: ClientOptions;
}

export class WebsocketTransport extends Transport<WebsocketTransportOptions> {
    public duplex?: Duplex;
    private socket?: WebSocket;

    constructor(options: WebsocketTransportOptions) {
        super(options);
        this.reset();
    }

    reset() {
        if (this.socket) this.socket.close();

        if (this.duplex && !this.duplex.destroyed) this.duplex.destroy();

        this.socket = undefined;
        this.duplex = undefined;
    }

    connect(): Promise<void> {
        if (this.socket || this.duplex) throw new IllegalStateError('WebSocket still connected.');

        this.socket = new WebSocket(this.options.url, this.options.additionalOptions);
        this.duplex = WebSocket.createWebSocketStream(this.socket, { objectMode: true });

        const socket = this.socket;
        return new Promise((resolve, reject) => {
            socket.once('open', () => {
                resolve();
                socket.removeAllListeners('error');
            });
            socket.once('error', () => {
                reject();
                socket.removeAllListeners('open');
            });
        });
    }
}

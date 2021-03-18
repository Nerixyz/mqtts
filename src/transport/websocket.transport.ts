import { Transport } from './transport';
import * as WebSocket from 'ws';
import { ClientOptions } from 'ws';
import { Duplex } from 'stream';
import duplexify = require('duplexify');
import { Duplexify } from 'duplexify';

export interface WebsocketTransportOptions {
    url: string;
    additionalOptions?: ClientOptions;
}

export class WebsocketTransport extends Transport<WebsocketTransportOptions> {
    // this will be set on the constructor
    public duplex!: Duplexify;
    private socket?: WebSocket;
    private socketStream?: Duplex;
    constructor(options: WebsocketTransportOptions) {
        super(options);
        this.reset();
    }

    reset() {
        this.duplex = duplexify(undefined, undefined, { objectMode: true });
    }

    connect(): Promise<void> {
        this.socket = new WebSocket(this.options.url, this.options.additionalOptions);
        this.socketStream = WebSocket.createWebSocketStream(this.socket, { objectMode: true });
        this.duplex.setReadable(this.socketStream);
        this.duplex.setWritable(this.socketStream);

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

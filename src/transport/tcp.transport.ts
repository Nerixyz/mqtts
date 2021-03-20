import { Transport } from './transport';
import { connect, Socket } from 'net';
import { IllegalStateError } from '../errors';

export interface TcpTransportOptions {
    host: string;
    port: number;
}

export class TcpTransport extends Transport<TcpTransportOptions> {
    public duplex?: Socket;

    constructor(options: TcpTransportOptions) {
        super(options);
        this.reset();
    }

    reset() {
        if (this.duplex && !this.duplex.destroyed) this.duplex.destroy();

        this.duplex = undefined;
    }

    connect(): Promise<void> {
        if (this.duplex) throw new IllegalStateError('TcpSocket still connected');

        return new Promise(
            resolve =>
                (this.duplex = connect(this.options.port, this.options.host, () => {
                    resolve();
                })),
        );
    }
}

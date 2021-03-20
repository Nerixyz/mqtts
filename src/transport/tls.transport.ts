import { Transport } from './transport';
import { ConnectionOptions, connect, TLSSocket } from 'tls';
import { IllegalStateError } from '../errors';

export interface TlsTransportOptions {
    host: string;
    port: number;
    additionalOptions?: ConnectionOptions;
}
export class TlsTransport extends Transport<TlsTransportOptions> {
    public duplex?: TLSSocket;

    constructor(options: TlsTransportOptions) {
        super(options);
        this.reset();
    }

    reset() {
        if (this.duplex && !this.duplex.destroyed) this.duplex.destroy();

        this.duplex = undefined;
    }

    connect(): Promise<void> {
        return new Promise((res, rej) => {
            if (this.duplex)
                // this.duplex has to be undefined
                return rej(new IllegalStateError('TlsTransport still connected - cannot overwrite this.duplex'));

            this.duplex = connect(
                {
                    ...this.options.additionalOptions,
                    host: this.options.host,
                    port: this.options.port,
                },
                () => {
                    res();
                },
            );
        });
    }
}

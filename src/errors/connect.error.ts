import { CustomError } from 'ts-custom-error';

export class ConnectError extends CustomError {
    constructor(public status: string) {
        super(status);
    }
}

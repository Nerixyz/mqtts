export interface MqttsReconnectStrategy {
    /**
     * Whether reconnect should happen or not
     */
    check(reason?: any): boolean;
    /**
     * Reconnect when wait resolves
     */
    wait(): Promise<any>;

    /**
     * Reset reconnect attempts
     */
    reset(): any;
}

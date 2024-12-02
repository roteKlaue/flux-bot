export class ArgumentError extends Error {
    public argumentName: string;
    public reason: string;

    constructor(argumentName: string, reason: string) {
        super(`Error with argument "${argumentName}": ${reason}`);
        this.argumentName = argumentName;
        this.reason = reason;

        Object.setPrototypeOf(this, ArgumentError.prototype);
    }
}

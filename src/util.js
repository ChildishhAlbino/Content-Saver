import { validateSource } from './sources'

export function createMessage(
    source,
    destination,
    payload,
    reference
) {
    if (!source) {
        throw Error("Source cannot be null")
    }

    if (!validateSource(source)) {
        throw Error("Source cannot be invalid.")
    }

    if (destination && !validateSource(destination)) {
        throw Error("Destination cannot be invalid.")
    }

    return {
        SOURCE: source,
        DESTINATION: destination,
        PAYLOAD: payload,
        REFERENCE: reference,
    }
}

export function validateMessage(message, validator) {
    const messageHasSource = !!message.SOURCE
    const validatorIsDestination = validator == message.DESTINATION
    const messageHasNoDestination = !message.DESTINATION
    return (messageHasSource && (validatorIsDestination || messageHasNoDestination))
}
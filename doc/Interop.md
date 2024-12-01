# Interop

The ``Interop`` class provides a unified interface for handling both Discord ``CommandInteraction`` and ``Message`` objects, abstracting their differences and offering consistent methods for operations like sending follow-ups and deleting messages.

## Constructor

```ts
constructor(base: CommandInteraction | Message, isPrivate: boolean);
```

* **Parameters**:

  * ``base``: The ``CommandInteraction`` or ``Message`` instance to wrap.
  * ``isPrivate``: A boolean indicating whether the interaction is private.

* **Throws**:
  * ``TypeError`` if the ``base`` is neither a ``CommandInteraction`` nor a ``Message``.

## Properties

1. ``member: GuildMember | undefined``

  The ``GuildMember`` associated with the interaction or message, if applicable.

2. ``channel: Channel | null``

  The channel where the interaction or message originated.

3. ``guild: Guild | null``

  The guild (server) where the interaction or message originated, if applicable.

4. ``createdAt: Date``

  The timestamp when the interaction or message was created.

5. ``user: User``

  The user who initiated the interaction or message.

6. ``isPrivate: boolean``

  Indicates whether the interaction or message is private.

## Methods

1. `followUp(content: MessagePayload): Promise<Interop<T>>`
  
  Sends a follow-up message or response.

* **Parameters**:
  * ``content``: The content of the follow-up message. This can include:
    * string: Plain text.
    * object: An object with optional properties:
      * ``content``: The text content.
      * ``embeds``: An array of ``EmbedBuilder`` objects.
      * ``components``: An array of ``APIActionRowComponent`` objects.

* **Returns**:
  * A ``Promise`` resolving to a new ``Interop`` instance representing the follow-up message.

* Example:
  
  ```ts
  const followUpInterop = await interop.followUp({
      content: "Here is your response!",
      embeds: [new EmbedBuilder().setTitle("Embed Example")],
  });
  ```

2. `delete(): Promise<void>`
  Deletes the interaction's reply or the message.

* **Returns**:
  * A ``Promise`` that resolves when the deletion is successful.

* **Throws**:
  * An error if ``delete`` is called on a private interaction.

## Static Methods

1. `isCommandInteraction(base: any): base is CommandInteraction`

  Type guard for checking if an object is a ``CommandInteraction``.
  
* **Parameters**:
  * ``base``: The object to check.
* **Returns**:
  * ``true`` if the object is a ``CommandInteraction``, otherwise ``false``.

2. `isMessage(base: any): base is Message`

Type guard for checking if an object is a ``Message``.

* **Parameters**:
  * ``base``: The object to check.
* **Returns**:
  * ``true`` if the object is a ``Message``, otherwise ``false``.

## Type Definitions

### `MessagePayload`

The structure of the payload for follow-up messages.

```ts
type MessagePayload = string | {
    content?: string;
    embeds?: EmbedBuilder[];
    components?: APIActionRowComponent<APIMessageActionRowComponent>[];
};
```

#### Fields:

* ``content``: (optional) The text content of the message.
* ``embeds``: (optional) An array of ``EmbedBuilder`` objects for rich content.
* ``components``: (optional) An array of ``APIActionRowComponent`` for interactive elements.

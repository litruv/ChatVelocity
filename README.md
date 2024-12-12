# ChatVelocity

ChatVelocity is a real-time Twitch chat visualization tool that consolidates emotes from multiple platforms (like Twitch and 7TV) and displays messages in customizable columns. It offers an interactive chat experience with settings for columns and message length, ideal for streamers and viewers who want to enhance their chat engagement.

**Website:** [velocity.ruv.wtf](https://velocity.ruv.wtf)

## Features

- **Real-Time Twitch Chat**: Displays messages from a specified Twitch channel.
- **Customizable Chat Settings**: Adjust the minimum word count for messages and the number of columns to display.
- **Twitch Emote Support**: Includes both native Twitch emotes and 7TV emotes.
- **Dynamic Message Display**: Organizes messages into columns and updates in real-time.
- **User Customization**: Set the number of columns and minimum word length via settings.

## Setup

To run ChatVelocity, you'll need to deploy the backend Cloudflare Worker and the front-end web files.

### Cloudflare Worker Setup

1. **Deploy the worker** on Cloudflare by adding the `cloudflareworker.js` script.
2. **Configure your Twitch API credentials** in the environment variables:
   - `TWITCH_CLIENT_ID`
   - `TWITCH_CLIENT_SECRET`
3. The worker handles requests to `/twitch/userdata` and fetches user and emote data from Twitch and 7TV.

### Front-End Setup

1. **Clone the repository** and place `index.html`, `script.js`, and `styles.css` on your server.
2. Update the frontend to interact with the deployed Cloudflare Worker API by fetching data from `https://twitchapi.ruv.wtf/twitch/userdata`.
3. Customize settings like `minWords` and `columns` in the UI to personalize your experience.

## Usage

1. Visit the site: `velocity.ruv.wtf`.
2. Add a Twitch username to the URL query string: `?user=<username>`.
3. Modify the chat layout with the settings box for **Minimum Words** per message and **Columns** to display.

## Example URL:
`https://velocity.ruv.wtf?user=zackrawrr`

## Dependencies

- **Twitch API**: Fetches user data and emotes.
- **7TV API**: Fetches additional emotes for enhanced chat experience.
- **TMI.js**: A library for handling Twitch chat messages.

## Contributing

Feel free to fork and contribute! If you find bugs or have feature requests, open an issue or submit a pull request.

## License

This project is licensed under the MIT License.
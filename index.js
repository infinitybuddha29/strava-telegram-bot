const { Telegraf } = require('telegraf');
const strava = require('strava-v3');
const express = require('express');
const fs = require('fs-extra');
const { setIntervalAsync } = require('set-interval-async/dynamic');

require('dotenv').config();

const TELEGRAM_API_TOKEN = process.env.TELEGRAM_API_TOKEN;
const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const OAUTH_REDIRECT_URI = process.env.NODE_ENV === 'production' ? process.env.PROD_OAUTH_REDIRECT_URI : process.env.LOCAL_OAUTH_REDIRECT_URI ;

const bot = new Telegraf(TELEGRAM_API_TOKEN);

bot.start(async (ctx) => {
    const chatId = ctx.message.chat.id;
    const authUrl = `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(OAUTH_REDIRECT_URI)}&approval_prompt=force&scope=activity:read_all&state=${chatId}`

    await ctx.reply(
        `Добро пожаловать! Чтобы связать ваш аккаунт Strava с этим ботом, перейдите по следующей ссылке: ${authUrl}`
    );
});

bot.launch();

const app = express();

const TOKENS_FILE = 'user_tokens.json';

async function saveUserToken(chatId, accessToken) {
    let tokens;
    try {
        tokens = await fs.readJson(TOKENS_FILE);
    } catch (error) {
        tokens = {};
    }

    tokens[chatId] = accessToken;
    await fs.writeJson(TOKENS_FILE, tokens);
}

app.get('/oauth/callback', async (req, res) => {
    const chatId = req.query.state;
    const code = req.query.code;

    if (chatId && code) {
        try {
            const response = await strava.oauth.getToken(code, STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET);
            const accessToken = response.access_token;
            console.log('saveUserToken', chatId, accessToken);
            await saveUserToken(chatId, accessToken);
            res.send('Успешно зарегистрирован');
        } catch (error) {
            res.send('Ошибка');
        }
    } else {
        res.send('Ошибка');
    }
});


async function checkActivities() {
    let userTokens;
    try {
        userTokens = await fs.readJson(TOKENS_FILE);
    } catch (error) {
        userTokens = {};
    }

    for (const [chatId, accessToken] of Object.entries(userTokens)) {
        try {
            const activities = await strava.athlete.listActivities({
                access_token: accessToken,
                per_page: 5,
            });

            for (const activity of activities) {
                bot.telegram.sendMessage(
                    chatId,
                    `${activity.name}: ${activity.distance} метров, время ${activity.elapsed_time}`
                );
            }
        } catch (error) {
            console.log('Error fetching activities:', error);
        }
    }
}

const CHECK_INTERVAL = 60 * 60 * 1000; // Check every hour
setIntervalAsync(checkActivities, CHECK_INTERVAL);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});


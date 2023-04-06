const { Telegraf } = require('telegraf');
const strava = require('strava-v3');
const express = require('express');
//const { createLeaderboard } = require('./utils');
const { updateUser, updateAllUsersActivities, checkIfUserExists, supabase } = require('./api');

require('dotenv').config();

const TELEGRAM_API_TOKEN = process.env.NODE_ENV === 'production' ? process.env.TELEGRAM_API_TOKEN : process.env.TELEGRAM_API_TOKEN_LOCAL;
const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const OAUTH_REDIRECT_URI = process.env.NODE_ENV === 'production' ? process.env.PROD_OAUTH_REDIRECT_URI : process.env.LOCAL_OAUTH_REDIRECT_URI ;

const bot = new Telegraf(TELEGRAM_API_TOKEN);

bot.start(async (ctx) => {
    ctx.reply('Добро пожаловать! Чтобы зарегистрироваться, используйте команду /register.');
});

// Отправка ссылки для регистрации пользователя или в случае если такой пользователь уже зареган, отправка сообщения об этом.
bot.command('register', async (ctx) => {
    await ctx.reply(`Считаем считаем...`);
    const userId = ctx.message.from.id;
    const username = ctx.message.from.username;
    const stateEncoded = encodeURIComponent(JSON.stringify({ userId, username}));
    const isExistingUser = await checkIfUserExists(userId);
    const authUrl = `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(OAUTH_REDIRECT_URI)}&approval_prompt=force&scope=activity:read_all&state=${stateEncoded}`
    console.log(isExistingUser);
    if (isExistingUser) {
        await ctx.reply(`Привет ${username}! Вы уже зарегистрированы в системе.`);
    } else {
        await ctx.reply(
            `Чтобы связать ваш аккаунт Strava с этим ботом, перейдите по следующей ссылке: ${authUrl}`
        );
    }
});

bot.launch();

const app = express();

// Connect user tg and strava account
app.get('/oauth/callback', async (req, res) => {
    const { code, state } = req.query;
    const { access_token: accessToken } = await strava.oauth.getToken(code, STRAVA_CLIENT_SECRET);
    const stateDecoded = decodeURIComponent(state);
    const { userId, username } = JSON.parse(stateDecoded);

    await updateUser({ userId, username, accessToken} );
    res.send('Вы успешно зарегистрировались! Теперь вы можете вернуться в чат.')
});

bot.command('leaderboard', async (ctx) => {
    await updateAllUsersActivities();
    const { data: users, error } = await supabase
        .from('users')
        .select('username, activities');

    if (error) {
        console.log('Error fetching users:', error);
        return;
    }

    //const leaderboard = createLeaderboard(users);
    ctx.reply('Активность пользователей за последние 7 дней.')
    //ctx.reply(`\`\`\`\n${leaderboard}\n\`\`\``, { parse_mode: 'MarkdownV2' });
});

bot.command('updateLeaderboard', async (ctx) => {
    await updateAllUsersActivities();
    const lastUpdateTime = new Date();
    const formattedLastUpdateDate = `${lastUpdateTime.getDate()}.${lastUpdateTime.getMonth() + 1} в ${lastUpdateTime.getHours()}:${lastUpdateTime.getMinutes()}`;
    ctx.reply(`Последнее обновление данных ${formattedLastUpdateDate}`)
})


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});


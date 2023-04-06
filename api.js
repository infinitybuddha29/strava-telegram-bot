const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const strava = require('strava-v3');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;

async function refreshAccessToken(user) {
    try {
        const response = await strava.oauth.refreshToken(user.stravaRefreshToken);
        const newAccessToken = response.access_token;
        const newRefreshToken = response.refresh_token;
        await updateUser({userId: user.userId, stravaToken: newAccessToken, stravaRefreshToken: newRefreshToken});
    } catch (error) {
        console.log('Error refreshing access token:', error);
        return null;
    }
}

const refreshAccessTokenForAllUsers = async () => {
    try {
        const { data: users, error } = await supabase
            .from('users')
            .select('id, strava_refresh_token');

        if (error) {
            console.log('Error fetching users for token update:', error);
            return;
        }

        for (const user of users) {
            await refreshAccessToken({ userId: user.id , stravaRefreshToken: user.strava_refresh_token })
        }
     } catch (err) {
        console.error(err);
    }
};

async function updateUser(user) {
    const updateData = {};

    //console.log('---UPDATE USER----', user);

    if (user.username) {
        updateData.username = user.username;
    }

    if (user.accessToken) {
        updateData.strava_token = user.accessToken;
    }

    if (user.refreshToken) {
        updateData.strava_refresh_token = user.refreshToken;
    }

    const { _, error } = await supabase
        .from('users')
        .upsert(({ id: user.userId, ...updateData }));

    if (error) {
        console.error('Error updating user:', error);
    }
}


async function checkIfUserExists(userId) {
    try {
        const { data: existingUser, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

        if (error) {
            console.log('Error checking for existing user:', error);
            return null;
        }

        return existingUser;
    } catch (error) {
        console.error('Unexpected error while checking for existing user:', error);
        return null;
    }
}

async function updateActivities(user) {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const lastActivityDate = user.activities ? new Date(Math.max.apply(null, user.activities.map(activity => new Date(activity.activity_date)))) : oneWeekAgo;
    const activities = await strava.athlete.listActivities({
        access_token: user.strava_token,
        after: Math.floor(lastActivityDate / 1000),
        per_page: 25
    })

    const newActivities = activities?.map(activity => ({
        activity_id: activity.id,
        activity_date: activity.start_date,
        activity_date_local: activity.start_date_local,
        activity_name: activity.name,
        activity_time: activity.moving_time
    }));

    if (newActivities.length > 0) {
        const currentActivities = user.activities || [];
        const updatedActivities = [...currentActivities, ...newActivities];

        const { _, updateError } = await supabase
            .from('users')
            .update({
                activities: updatedActivities
            })
            .eq('id', user.id);

        if (updateError) {
            console.log('Error updating activities:', updateError);
        }
    }
}


async function updateAllUsersActivities() {
    const { data: users, error } = await supabase
        .from('users')
        .select('id, strava_token, activities');

    if (error) {
        console.log('Error fetching users:', error);
        return;
    }

    for (const user of users) {
        await updateActivities(user);
    }
}

module.exports = {
    supabase,
    updateUser,
    updateAllUsersActivities,
    checkIfUserExists,
    refreshAccessTokenForAllUsers
}

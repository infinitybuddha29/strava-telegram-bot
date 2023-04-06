const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const strava = require('strava-v3');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function updateUser(user) {
    const updateData = {};

    console.log('USER', user);

    if (user.username) {
        updateData.username = user.username;
    }

    if (user.accessToken) {
        updateData.stravaToken = user.accessToken;
    }

    const { _, error } = await supabase
        .from('users')
        .upsert(Object.assign({ id: user.userId }, updateData));

    if (error) {
        console.error('Error updating user:', error);
    }
}


async function checkIfUserExists(chatId) {
    const { data: existingUser, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', chatId)
        .single();
    console.log(existingUser);

    if (error) {
        console.log('Error checking for existing user:', error);
        return;
    }

    return existingUser;
}

async function updateActivities(user) {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const lastActivityDate = user.activities ? new Date(Math.max.apply(null, user.activities.map(activity => new Date(activity.activity_date)))) : oneWeekAgo;
    const activities = await strava.athlete.listActivities({
        access_token: user.stravaToken,
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
        .select('id, stravaToken, activities');

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
    updateActivities,
    updateAllUsersActivities,
    checkIfUserExists
}

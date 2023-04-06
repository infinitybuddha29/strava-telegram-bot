function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    return `${hours}:${minutes}:${remainingSeconds}`;
}

function createLeaderboard(users) {
    console.log("EBAAAAA");
    const longestUsernameLength = users.reduce((maxLength, user) => Math.max(maxLength, user.username.length), 0);
    const usernameColumnWidth = Math.max(longestUsernameLength, 'Username'.length) + 2;
    const activitiesColumnWidth = 'Activities'.length + 2;

    const line = '+'.padEnd(usernameColumnWidth + 1, '-') + '+'.padEnd(activitiesColumnWidth + 1, '-') + '+\n';

    let table = line;
    table += '|' + ' Username'.padEnd(usernameColumnWidth) + '|' + ' Activities'.padEnd(activitiesColumnWidth) + '|\n';
    table += line;

    for (const user of users) {
        const activityCount = user.activities ? user.activities?.length : 0;
        table += '|' + ` ${user.username}`.padEnd(usernameColumnWidth) + '|' + ` ${activityCount}`.padEnd(activitiesColumnWidth) + '|\n';
    }

    table += line;
    return table;
}

module.exports = {
    formatTime,
    createLeaderboard
};

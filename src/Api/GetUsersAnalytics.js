// @flow

const _ = require('underscore');
const moment = require('moment');

const app = require('../shared/Express');
const databaseref = require('../shared/Firebase');
const authentication = require('../shared/Authentication');
const result = require('../shared/RequestResult');
const tokenManager = require('../shared/TokenManager');
const webHelpers = require('../shared/WebConsoleHelpers');

app.get('/api/get_users_analytics', function(req, res) {
    var token = req.query.token;

    var auth = authentication.permissions(token);
    if (!auth.admin) {
        res.status(result.requestforbidden).send(result.invalidtoken);
        return;
    }

    tokenManager.incrementTokenCalls(token);

    var filter = req.query['filter'], school_identifier = req.query['school_identifier'],
        selected_date = moment(req.query['date']).startOf('day').toDate(), guid,
        timezone = req.query['timezone'];

    if (filter) {
        filter = JSON.parse(filter);
        guid = filter.group;
    }

    if (!school_identifier) school_identifier = 'duke'; //for tests only

    if(!school_identifier){
        res.status(result.requestbad).send("invalid parameters: no school identifier");
        return;
    }

    const getSchoolUsers = databaseref.child('schools').child(school_identifier).child('users').once('value');
    const getSessionsLog = databaseref.child('sessions_log').once('value');


    Promise.all([getSchoolUsers, getSessionsLog]).then(values => {
        let schoolUsers = values[0].val();
        const sessions_log = values[1].val() ||  {};
        // fs.writeFileSync('sessions.json', JSON.stringify(sessions_log), {
        //     encoding: 'utf-8'
        // });
        
        webHelpers.filterUsers(schoolUsers, filter, school_identifier).then(users => {
            schoolUsers = users || {};

            let academic_levels = [];
            let graduation_years = [];
            let majors = [];

            Object.keys(schoolUsers).map(k => schoolUsers[k]).forEach(u => {
                if (['grad', 'undergrad'].includes(u.academic_level))
                    academic_levels.push(u.academic_level);
                
                if (u.graduation_year)
                    graduation_years.push(u.graduation_year);

                if (u.major)
                    majors.push(u.major);
            });
        
            //grad/undergrad chart
            const countGradUndergrad = _.countBy(academic_levels);
            const grad_undergrad_chart = [countGradUndergrad['grad'], countGradUndergrad['undergrad']];

            //grad_year chart
            const countGradYear = _.countBy(graduation_years);
            const years = Object.keys(countGradYear).sort();
            const grad_year_chart = {
                years,
                data: years.map(y => countGradYear[y])
            };

            //fields of study
            const majorMaps = {
                'cs': 'computer science',
                'compsci': 'computer science',
                'econ': 'economics',
                'gh': 'global health',
                'neuro': 'neuroscience',
                'public policy studies': 'public policy',
                'statz': 'statistics',
                'tbd': 'undecided'
            };
            majors = _.flatten(majors.map(m => m.toLowerCase().trim().split(/(?:[+,\/]|and)+/).map(s => s.trim())));
            majors = majors.map(m => (majorMaps[m] || m).split(' ').map(w => w.split('').map((l, i) => i === 0 ? l.toUpperCase() : l).join('')).join(' '));
            const countMajors = _.countBy(majors);
            const fields_of_study_chart = _.chain(countMajors).map((count, major) => Object({
                word: major,
                count: count
            })).sortBy('count').value().map((obj, i) => Object({
                word: obj.word,
                count: i + 1
            }));
        

            //sessions over time

            const hourFormat = 'YYYY-MM-DD-HH';
            const dayFormat = 'YYYY-MM-DD';
            const monthFormat = 'YYYY-MM';

            const dayLabel = 'h:00 A';
            const weekLabel = 'MMM. D, YYYY [-] dddd';
            const monthLabel = 'MMM. D, YYYY';
            const yearLabel = 'MMM. YYYY';

            let now = moment();
            const nowTimezone = now.clone();
            nowTimezone.tz(timezone);
            nowTimezone.add(nowTimezone.utcOffset() - now.utcOffset(), 'minutes');
            now = nowTimezone;

            // by day
            
            const selected_day_hours = Object.keys(sessions_log.sessions_by_hour ||  {}).sort()
            // filter 'by hours' sessions using the selected day
            .filter(k => moment(k, hourFormat).startOf('day').diff(selected_date, 'days') === 0);

            const sessions_by_day = [];
            for (let h = 0; h <= 23; h++) {
                const itemDate = moment(selected_date).hours(h);
                // console.log(itemDate.format(dayLabel), now.endOf('hour').format(), itemDate.endOf('hour').format(), moment(itemDate).endOf('hour').diff(now.endOf('hour')));
                if (moment(itemDate).endOf('hour').diff(now.endOf('hour')) > 0) continue;
                const label = itemDate.format(dayLabel);
                const currentHourThisDay = selected_day_hours.filter(k => moment(k, hourFormat).hour() === h)[0];
                if (!currentHourThisDay) {
                    sessions_by_day.push({
                        label,
                        count: 0
                    });
                } else {
                    sessions_by_day.push({
                        label,
                        count: Object.keys((sessions_log.sessions_by_hour ||  {})[currentHourThisDay][guid ? 'groups' : 'sessions'] || {}).length
                    });
                }
            }

            // by week

            const startOfWeek = moment(selected_date).startOf('week');
            const endOfWeek = moment(selected_date).endOf('week');

            const selected_week_days = Object.keys(sessions_log.sessions_by_day ||  {}).sort()
            // filter 'by days' sessions using the selected day
            .filter(k => moment(k, dayFormat).isBetween(startOfWeek, endOfWeek, null, '[]'));

            const sessions_by_week = [];
            for (let d = 0; d <= 6; d++) {
                const itemDate = moment(startOfWeek).add(d, 'days');
                if (moment(itemDate).endOf('day').diff(now.endOf('day')) > 0) continue;
                const label = itemDate.format(weekLabel);
                const currentDayThisWeek = selected_week_days.filter(k => moment(k, dayFormat).weekday() === d)[0];
                if (!currentDayThisWeek) {
                    sessions_by_week.push({
                        label,
                        count: 0
                    });
                } else {
                    sessions_by_week.push({
                        label,
                        count: Object.keys((sessions_log.sessions_by_day ||  {})[currentDayThisWeek][guid ? 'groups' : 'sessions'] || {}).length
                    });
                }
            }

            // by month

            const startOfMonth = moment(selected_date).startOf('month');
            const endOfMonth = moment(selected_date).endOf('month');
            const numOfDaysInMonth = moment(selected_date).daysInMonth();

            const selected_month_days = Object.keys(sessions_log.sessions_by_day ||  {}).sort()
            // filter 'by days' sessions using the selected day
            .filter(k => moment(k, dayFormat).isBetween(startOfMonth, endOfMonth, null, '[]'));


            const sessions_by_month = [];
            for (let d = 1; d <= numOfDaysInMonth; d++) {
                const itemDate = moment(startOfMonth).add(d - 1, 'days');
                if (moment(itemDate).endOf('day').diff(now.endOf('day')) > 0) continue;
                const label = itemDate.format(monthLabel);
                const currentDayThisMonth = selected_month_days.filter(k => moment(k, dayFormat).date() === d)[0];
                
                if (!currentDayThisMonth) {
                    sessions_by_month.push({
                        label,
                        count: 0
                    });
                } else {
                    sessions_by_month.push({
                        label,
                        count: Object.keys((sessions_log.sessions_by_day ||  {})[currentDayThisMonth][guid ? 'groups' : 'sessions'] || {}).length
                    });
                }
            }


            // by year

            const startOfYear = moment(selected_date).startOf('year');
            const endOfYear = moment(selected_date).endOf('year');

            const selected_year_months = Object.keys(sessions_log.sessions_by_month ||  {}).sort()
            // filter 'by days' sessions using the selected day
            .filter(k => moment(k, monthFormat).isBetween(startOfYear, endOfYear, null, '[]'));

            const sessions_by_year = [];
            for (let m = 0; m <= 11; m++) {
                const itemDate = moment(startOfYear).add(m, 'months');
                if (moment(itemDate).endOf('month').diff(now.endOf('month')) > 0) continue;
                const label = itemDate.format(yearLabel);
                const currentMonthThisYear = selected_year_months.filter(k => moment(k, monthFormat).month() === m)[0];
                if (!currentMonthThisYear) {
                    sessions_by_year.push({
                        label,
                        count: 0
                    });
                } else {
                    sessions_by_year.push({
                        label,
                        count: Object.keys((sessions_log.sessions_by_month ||  {})[currentMonthThisYear][guid ? 'groups' : 'sessions'] || {}).length
                    });
                }
            }

            res.status(result.requestsuccessful).send({
                // charts
                grad_undergrad_chart,
                grad_year_chart,
                fields_of_study_chart,
                // session over time charts
                sessions_by_day,
                sessions_by_week,
                sessions_by_month,
                sessions_by_year
            });

        });

    });
});
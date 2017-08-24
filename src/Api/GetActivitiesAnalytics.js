// @flow

const _ = require('underscore');
const moment = require('moment');

const app = require('../shared/Express');
const databaseref = require('../shared/Firebase');
const authentication = require('../shared/Authentication');
const result = require('../shared/RequestResult');
const tokenManager = require('../shared/TokenManager');
const webHelpers = require('../shared/WebConsoleHelpers');

app.get('/api/get_activities_analytics', function(req, res) {
    var token = req.query.token;

    var auth = authentication.permissions(token);
    if (!auth.admin) {
        res.status(result.requestforbidden).send(result.invalidtoken);
        return;
    }

    tokenManager.incrementTokenCalls(token);


    var filter = req.query['filter'], school_identifier = req.query['school_identifier'],
        selected_date = moment(req.query['date']).startOf('day').toDate(),
        timezone = req.query['timezone'];

    if (filter) {
        filter = JSON.parse(filter);
    }

    if (!school_identifier) school_identifier = 'duke'; //for tests only

    if(!school_identifier){
        res.status(result.requestbad).send("invalid parameters: no school identifier");
        return;
    }

    var schoolRef = databaseref.child('schools').child(school_identifier);
    var getSchoolActivities = schoolRef.child('activities').once('value');
    var getSchoolGroups = schoolRef.child('groups').once('value');
    var getSchoolUsers = schoolRef.child('users').once('value');

    Promise.all([getSchoolActivities, getSchoolGroups, getSchoolUsers]).then(values => {
        var schoolActivities = values[0].val();
        var schoolGroups = values[1].val();
        var schoolUsers = values[2].val();

        let freeFoodEvents = 0;
        let totalPlanningTime = 0;


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

        //event posting over time

        const events_posting_over_time = {
            by_hours: {},
            by_days: {},
            by_months: {}
        };

        const events_time_over_time = {
            by_hours: {},
            by_days: {},
            by_months: {}
        };

        const events_attendance_over_time = {
            by_hours: {},
            by_days: {},
            by_months: {}
        };

        const usersRelatedToActivities = [];
        
        webHelpers.filterActivities(Object.keys(schoolActivities).map(k => schoolActivities[k]), filter, school_identifier).then(schoolActivities => {

            schoolActivities.forEach(a => {
                if ((a.interests || []).includes('Free Food'))
                    freeFoodEvents++;

                const postedAt = moment(a.timePosted * 1000);
                const eventAt = moment(a.start_time * 1000);

                totalPlanningTime += eventAt.diff(postedAt, 'seconds');

                const hourPostingLabel = postedAt.format(hourFormat);
                const dayPostingLabel = postedAt.format(dayFormat);
                const monthPostingLabel = postedAt.format(monthFormat);

                const hourEventLabel = eventAt.format(hourFormat);
                const dayEventLabel = eventAt.format(dayFormat);
                const monthEventLabel = eventAt.format(monthFormat);

                events_posting_over_time.by_hours[hourPostingLabel] = (events_posting_over_time.by_hours[hourPostingLabel] || 0) + 1;
                events_posting_over_time.by_days[dayPostingLabel] = (events_posting_over_time.by_days[dayPostingLabel] || 0) + 1;
                events_posting_over_time.by_months[monthPostingLabel] = (events_posting_over_time.by_months[monthPostingLabel] || 0) + 1;

                events_time_over_time.by_hours[hourEventLabel] = (events_time_over_time.by_hours[hourEventLabel] || 0) + 1;
                events_time_over_time.by_days[dayEventLabel] = (events_time_over_time.by_days[dayEventLabel] || 0) + 1;
                events_time_over_time.by_months[monthEventLabel] = (events_time_over_time.by_months[monthEventLabel] || 0) + 1;

                if (a.replies) {
                    const attendees = Object.keys(a.replies).map(k => a.replies[k]).filter(r => r === 'going').length;

                    events_attendance_over_time.by_hours[hourEventLabel] = (events_attendance_over_time.by_hours[hourEventLabel] || 0) + attendees;
                    events_attendance_over_time.by_days[dayEventLabel] = (events_attendance_over_time.by_days[dayEventLabel] || 0) + attendees;
                    events_attendance_over_time.by_months[monthEventLabel] = (events_attendance_over_time.by_months[monthEventLabel] || 0) + attendees;
                }

                const replies = a.replies ||  {};
                Object.keys(replies).filter(k => replies[k] === 'going')
                        .forEach(k => usersRelatedToActivities.push(k));

                if (a.host_group) {
                    const actGroup = schoolGroups[a.host_group];
                    if (actGroup && actGroup.members) {
                        Object.keys(actGroup.members).forEach(k => usersRelatedToActivities.push(k));
                    }
                } else {
                    usersRelatedToActivities.push(a.host);
                }
            });

            const academic_levels = [];
            const graduation_years = [];
            let majors = [];

            _.uniq(usersRelatedToActivities).map(k => schoolUsers[k]).forEach(u => {
                if (!u) return;
                if (['grad', 'undergrad'].includes(u.academic_level))
                    academic_levels.push(u.academic_level);
                
                if (u.graduation_year)
                    graduation_years.push(u.graduation_year);

                if (u.major)
                    majors.push(u.major);
            });



            //grad/undergrad chart
            var countGradUndergrad = _.countBy(academic_levels);
            var grad_undergrad_chart = [countGradUndergrad['grad'], countGradUndergrad['undergrad']];

            //grad_year chart
            var countGradYear = _.countBy(graduation_years);
            var years = Object.keys(countGradYear).sort();
            var grad_year_chart = {
                years: years,
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
            var countMajors = _.countBy(majors);
            var fields_of_study_chart = _.chain(countMajors).map((count, major) => Object({
                word: major,
                count: count
            })).sortBy('count').value().map((obj, i) => Object({
                word: obj.word,
                count: i + 1
            }));

            // events avg planning time

            const events_avg_planning_time = Math.round(totalPlanningTime / schoolActivities.length);

            // free food events
            var free_food_events_chart = [freeFoodEvents, schoolActivities.length - freeFoodEvents];


            // event time/event posting time over time

            const getChartData = obj => {
                // by day
                
                const selected_day_hours = Object.keys(obj.by_hours).sort()
                // filter 'by hours' sessions using the selected day
                .filter(k => moment(k, hourFormat).startOf('day').diff(selected_date, 'days') === 0);

                const events_by_day = [];
                for (let h = 0; h <= 23; h++) {
                    const itemDate = moment(selected_date).hours(h);
                    if (moment(itemDate).endOf('hour').diff(now.endOf('hour')) > 0) continue;
                    const label = itemDate.format(dayLabel);
                    const currentHourThisDay = selected_day_hours.filter(k => moment(k, hourFormat).hour() === h)[0];
                    if (!currentHourThisDay) {
                        events_by_day.push({
                            label,
                            count: 0
                        });
                    } else {
                        events_by_day.push({
                            label,
                            count: obj.by_hours[currentHourThisDay]
                        });
                    }
                }

                // by week

                const startOfWeek = moment(selected_date).startOf('week');
                const endOfWeek = moment(selected_date).endOf('week');

                const selected_week_days = Object.keys(obj.by_days).sort()
                // filter 'by days' sessions using the selected day
                .filter(k => moment(k, dayFormat).isBetween(startOfWeek, endOfWeek, null, '[]'));

                const events_by_week = [];
                for (let d = 0; d <= 6; d++) {
                    const itemDate = moment(startOfWeek).add(d, 'days');
                    if (moment(itemDate).endOf('day').diff(now.endOf('day')) > 0) continue;
                    const label = itemDate.format(weekLabel);
                    const currentDayThisWeek = selected_week_days.filter(k => moment(k, dayFormat).weekday() === d)[0];
                    if (!currentDayThisWeek) {
                        events_by_week.push({
                            label,
                            count: 0
                        });
                    } else {
                        events_by_week.push({
                            label,
                            count: obj.by_days[currentDayThisWeek]
                        });
                    }
                }

                // by month

                const startOfMonth = moment(selected_date).startOf('month');
                const endOfMonth = moment(selected_date).endOf('month');
                const numOfDaysInMonth = moment(selected_date).daysInMonth();

                const selected_month_days = Object.keys(obj.by_days).sort()
                // filter 'by days' sessions using the selected day
                .filter(k => moment(k, dayFormat).isBetween(startOfMonth, endOfMonth, null, '[]'));


                const events_by_month = [];
                for (let d = 1; d <= numOfDaysInMonth; d++) {
                    const itemDate = moment(startOfMonth).add(d - 1, 'days');
                    if (moment(itemDate).endOf('day').diff(now.endOf('day')) > 0) continue;
                    const label = itemDate.format(monthLabel);
                    const currentDayThisMonth = selected_month_days.filter(k => moment(k, dayFormat).date() === d)[0];
                    
                    if (!currentDayThisMonth) {
                        events_by_month.push({
                            label,
                            count: 0
                        });
                    } else {
                        events_by_month.push({
                            label,
                            count: obj.by_days[currentDayThisMonth]
                        });
                    }
                }


                // by year

                const startOfYear = moment(selected_date).startOf('year');
                const endOfYear = moment(selected_date).endOf('year');

                const selected_year_months = Object.keys(obj.by_months).sort()
                // filter 'by days' sessions using the selected day
                .filter(k => moment(k, monthFormat).isBetween(startOfYear, endOfYear, null, '[]'));

                const events_by_year = [];
                for (let m = 0; m <= 11; m++) {
                    const itemDate = moment(startOfYear).add(m, 'months');
                    if (moment(itemDate).endOf('month').diff(now.endOf('month')) > 0) continue;
                    const label = itemDate.format(yearLabel);
                    const currentMonthThisYear = selected_year_months.filter(k => moment(k, monthFormat).month() === m)[0];
                    if (!currentMonthThisYear) {
                        events_by_year.push({
                            label,
                            count: 0
                        });
                    } else {
                        events_by_year.push({
                            label,
                            count: obj.by_months[currentMonthThisYear]
                        });
                    }
                }

                return {
                    by_day: events_by_day,
                    by_week: events_by_week,
                    by_month: events_by_month,
                    by_year: events_by_year
                };

                
            };

            res.status(result.requestsuccessful).send({
                free_food_events_chart,
                events_posting_over_time: getChartData(events_posting_over_time),
                events_time_over_time: getChartData(events_time_over_time),
                events_attendance_over_time: getChartData(events_attendance_over_time),
                events_avg_planning_time,
                events_by_audience: {
                    grad_undergrad_chart,
                    grad_year_chart,
                    fields_of_study_chart
                }
            });
        });
    });

});
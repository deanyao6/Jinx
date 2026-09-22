-- The provider incorrectly supplied the stadium name as its city.
-- Club address: https://www.fcdallas.com/stadium/contact (9200 World Cup Way, Frisco, TX).
update public.venues set city = 'Frisco', state = 'TX', tz = 'America/Chicago'
where key = 'mls-espn-7474';

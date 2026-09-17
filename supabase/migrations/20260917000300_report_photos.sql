-- Fan photos can be reported (SPEC.md 6.19: "Fan uploads get the same report and block tools as
-- other user content"; Section 11: report content and users).
--
-- reports.target_type had no value for a photo, so the only thing a viewer could report from
-- "From fans at this game" was the whole user. Reporting the item itself is what a moderator
-- needs: the report names the exact photo, and the photo may be the only thing wrong.
alter table public.reports drop constraint reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('user', 'attendance', 'feed_event', 'person', 'attendance_photo'));

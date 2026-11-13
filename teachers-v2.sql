-- Teachers v2: teachers can exist without a login (email added later by the registrar), plus the staff list.
begin;
alter table public.teachers add column if not exists id uuid not null default gen_random_uuid();
alter table public.teachers add column if not exists designation text not null default '';
alter table public.teachers add column if not exists qualification text not null default '';
alter table public.teachers add column if not exists sort_no integer;
alter table public.teachers drop constraint if exists teachers_pkey;
alter table public.teachers add constraint teachers_pkey primary key (id);
alter table public.teachers alter column email drop not null;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'teachers_email_key') then
    alter table public.teachers add constraint teachers_email_key unique (email);
  end if;
end $$;

-- Registrar gives an existing teacher an email, which also creates their login.
create or replace function public.set_teacher_login(p_id uuid, p_email text, p_password text) returns text
language plpgsql security definer set search_path to 'public' as $$
declare em text := lower(trim(p_email)); nm text;
begin
  if not public.is_manager() then raise exception 'Only managers can do this.'; end if;
  if em !~ '^[^@\s]+@gcslahore\.edu\.pk$' then raise exception 'Use a full @gcslahore.edu.pk email.'; end if;
  if exists (select 1 from public.teachers where email = em and id <> p_id) then raise exception 'Another teacher already uses this email.'; end if;
  update public.teachers set email = em where id = p_id returning name into nm;
  if not found then raise exception 'Teacher not found.'; end if;
  return public.create_login(em, nm, p_password);
end $$;
revoke all on function public.set_teacher_login(uuid, text, text) from public, anon;
grant execute on function public.set_teacher_login(uuid, text, text) to authenticated;

-- Staff list. Teachers already in the app (matched by email) are updated, not duplicated.
create temp table staff (email text, name text, department text, designation text, qualification text, sort_no int) on commit drop;
insert into staff values
(null, 'Mr. Mati-ur-Rehman', 'Arabic', 'Lecturer', 'M.Phil', 6),
(null, 'Dr. Mukhtar Hussain Shah', 'Botany & Biology', 'Professor/HOD', 'Ph.D', 7),
(null, 'Ms. Nasira Parveen', 'Botany & Biology', 'Asso.Prof', 'M.Sc', 8),
(null, 'Dr. Raza Hafeez Ahmad', 'Botany & Biology', 'Asso.Prof', '', 9),
(null, 'Mr. Adnan Khalid', 'Botany & Biology', 'Asstt.prof/HOD (Biotechnology)', 'M.Sc', 10),
(null, 'Dr. Muhammad Tariq', 'Botany & Biology', 'Asstt.Prof Biology', 'Ph.D', 11),
(null, 'Mr. Muhammad Qasim', 'Botany & Biology', 'Lecturer', 'M.Sc', 12),
(null, 'Ms. Atiqa Wajed', 'Botany & Biology', 'Lecturer', 'M.Phil', 13),
(null, 'Dr. Qamar Subhani', 'Chemistry', 'Professor/HOD', '', 14),
(null, 'Dr. Muhammad Salim', 'Chemistry', 'Professor', 'Ph.D', 15),
(null, 'Dr. M. Monim ul Mahboob', 'Chemistry', 'Professor', 'Ph.D', 16),
(null, 'Dr. Fauzia Anjum Chattat', 'Chemistry', 'Professor', 'Ph.D', 17),
(null, 'Mr. Zahid Sharif Ch.', 'Chemistry', 'Asso. Prof.', 'M.Phil', 18),
(null, 'Mr. Muhammad Arshad Bhatti', 'Chemistry', 'Asso. Prof.', 'M.Phil', 19),
(null, 'Dr. Asif Masaud Khurum', 'Chemistry', 'Asso. Prof.', 'Ph.D', 20),
(null, 'Mr. Anfas Ahmad', 'Chemistry', 'Asso. Prof', 'M.Phil', 21),
(null, 'Mr. Naveed Aslam Dogar', 'Chemistry', 'Asstt.Prof', 'M.Phil', 22),
(null, 'Dr. Tariq Mehmood', 'Chemistry', 'Asstt.Prof', 'Ph.D', 23),
(null, 'Dr. Iftikhar Hussain', 'Chemistry', 'Asstt.Prof', 'Ph.D', 24),
(null, 'Dr. Abdul Rauf', 'Chemistry', 'Asstt.Prof', 'Ph.D', 25),
(null, 'Dr. Abida Hassan', 'Chemistry', 'Asstt.Prof', 'Ph.D', 26),
(null, 'Dr. Muhammad Waheed Mushtaq', 'Chemistry', 'Lecturer', 'Ph.D', 27),
(null, 'Mr. Sajjad Hussain', 'Chemistry', 'Lecturer', 'M.Phil', 28),
(null, 'Ms. Zunaira Jamal', 'Chemistry', 'Lecturer', '', 29),
(null, 'Ms. Hamna Akram', 'Chemistry', 'Lecturer', '', 30),
(null, 'Mr. Shahzada Shahab Khan', 'Commerce', 'Assoc Prof', '', 31),
(null, 'Ms. Hifsa Farooq', 'Commerce', 'Asstt. Prof.', 'M.Phil', 32),
(null, 'Ms. Asifa Sohail', 'Commerce', 'Asstt. Prof.', 'M.Phil', 33),
(null, 'Mr. Faisal Shehzad', 'Commerce', 'Lecturer', 'M.Phil', 34),
(null, 'Ms. Sana Shahzad', 'Commerce', 'Lecturer', 'M.Phil', 35),
(null, 'Mr. Ejaz Ahmad', 'Computer Science', 'Asso.Prof/HOD', 'M.Phil', 36),
('sadaf@gcslahore.edu.pk', 'Ms. Sadaf Siddique', 'Computer Science', 'Asstt.Prof', 'M.Phil', 37),
('abdul.wahab@gcslahore.edu.pk', 'Mr. Abdul Wahab', 'Computer Science', 'Asstt.Prof', 'M.Phil', 38),
('zeeshan@gcslahore.edu.pk', 'Mr. Muhammad Zeeshan', 'Computer Science', 'Asstt.Prof', 'M.Phil', 39),
(null, 'Mrs. Noureen Tariq', 'Computer Science', 'Lecturer', 'M.S', 40),
(null, 'Dr. M. Khalid Rashid', 'Economics', 'Professor/HOD', 'Ph.D', 41),
(null, 'Mr. Muhammad Tanveer', 'Economics', 'Asstt.Prof', 'M.A', 42),
(null, 'Mr. Iftikhar Ahmad', 'Economics', 'Asstt.Prof', 'M.Phil', 43),
(null, 'Dr. Muhammad Atiq-ur-Rehman', 'Economics', 'Asstt.prof', 'Ph.D', 44),
(null, 'Dr. Muhammad Reehan Hameed', 'Economics', 'Asstt. Prof', 'Ph.D', 45),
(null, 'Mr. Ghulam Farid', 'Economics', 'Asstt.prof', 'M.Phil', 46),
(null, 'Mr. Fahim Abbas', 'Economics', 'Asstt.prof', 'M.Phil', 47),
(null, 'Mr. Fahad Iqbal', 'Economics', 'Asstt.prof', 'M.Phil', 48),
(null, 'Mr. Naveed Munir', 'Economics', 'Lecturer', 'M.Phil', 49),
(null, 'Mr. Maaz Anis', 'Economics', 'Lecturer', 'M.Phil', 50),
(null, 'Mrs. Aneesa Razzaq', 'Economics', 'Lecturer', 'M.Phil', 51),
(null, 'Mrs. Naseem Akhtar', 'Economics', 'Lecturer', 'M.Phil', 52),
(null, 'Mr. Hamid Ali', 'Education', 'Assoc Prof/HOD', 'M.Phil', 53),
(null, 'Mr. Abdul Qayyum', 'Education', 'Asso. Prof.', 'M.A', 54),
(null, 'Mr. Junaid Ahmad Khan', 'Education', 'Asstt Prof', 'M.A', 55),
(null, 'Mr. Naveed Ahmad Taseer', 'Education', 'Lecturer', 'M.Phil', 56),
(null, 'Ms. Rida Shah', 'Education', 'Lecturer', 'M.Phil', 57),
(null, 'Ms. Sahar Fatima', 'Education', 'Lecturer', 'M.Phil', 58),
(null, 'Ms. Shumaila Hameed', 'Education', 'Lecturer', '', 59),
(null, 'Mr. Asif Mehmood Shaheen', 'English', 'Asso.Prof/HOD', '', 60),
(null, 'Mr. Muhammad Saleem Ahsan', 'English', 'Asso. Prof.', '', 61),
(null, 'Mrs. Nighat Iftikhar', 'English', 'Asso. Prof.', 'M.A', 62),
(null, 'Mrs. Saima Turab', 'English', 'Asso. Prof.', 'M.Phil', 63),
(null, 'Mr. Rana Yousaf', 'English', 'Asstt.Prof', 'M.Phil', 64),
(null, 'Dr. Nosheen Jaffar', 'English', 'Asstt.Prof', 'Ph.D', 65),
(null, 'Mr. Muhammad Mubashir', 'English', 'Asstt.Prof', 'M.Phil', 66),
(null, 'Dr. Nazir Ahmad', 'English', 'Asstt.Prof', 'Ph.D', 67),
(null, 'Dr. Muhammad Imran Khan', 'English', 'Asstt.Prof', 'Ph.D', 68),
(null, 'Ms. Ayesha Umer', 'English', 'Asstt.Prof', 'M.Phil', 69),
(null, 'Mr. Muhammad Talha', 'English', 'Lecturer', 'M.A', 70),
(null, 'Mr. Muhammad Shahryaar Shabir', 'English', 'Lecturer', 'M.Phil', 71),
(null, 'Mr. Nabeel Ahmad Minhas', 'English', 'Lecturer', 'M.Phil', 72),
(null, 'Ms. Hafsa Khan', 'English', 'Lecturer', 'M.Phil', 73),
(null, 'Ms. Aisha', 'English', 'Lecturer', 'M.Phil', 74),
(null, 'Dr. Muhammad Ghous', 'Geography', 'Asstt Prof', '', 75),
(null, 'Mr. Muhammad Sohail', 'Geography', 'Lecturer', 'M.Phil', 76),
(null, 'Ms. Kiran Hamayon', 'Geography', 'Lecturer', '', 77),
(null, 'Ms. Sadaf Safdar', 'Geography', 'Lecturer', '', 78),
(null, 'Mr. Mian Wajid Zahoor', 'Health & Physical Education', 'Asso.Prof', 'M.A', 79),
(null, 'Mr. Tariq Rashid', 'Health & Physical Education', 'Asso. Prof.', 'M.A', 80),
(null, 'Mr. Nasir Mahmood Khokhar', 'Health & Physical Education', 'Asso. Prof.', 'M.A', 81),
(null, 'Dr. M. Raza Taimoor', 'History', 'Professor/HOD', '', 82),
(null, 'Mr. Munir Ahmad Bhatti', 'History', 'Asstt.Prof', 'M.A', 83),
(null, 'Dr. M. Junaid Sharif', 'Islamiat', 'Professor/HOD', '', 84),
(null, 'Mr. Hifz ur Rehman Usmani', 'Islamiat', 'Asso.Prof', 'M.Phil', 85),
(null, 'Rao Muhammad Tariq Khan', 'Islamiat', 'Asso.Prof.', 'M.Phil', 86),
(null, 'Dr. Mehfooz Ahmad Bhatti', 'Islamiat', 'Lecturer', 'Ph.D', 87),
(null, 'Dr. Muhammad Ahmad', 'Islamiat', 'Lecturer', 'Ph.D', 88),
(null, 'Ms. Sammyia Sundus', 'Islamiat', 'Lecturer', '', 89),
(null, 'Dr. Shafayat Ali', 'Mass Communication', 'Asstt.Prof/HOD', 'Ph.D', 93),
(null, 'Ms. Saiba Ali', 'Mass Communication', 'Lecturer', 'M.Phil', 94),
(null, 'Ms. Nain Tara', 'Mass Communication', 'Lecturer', 'M.Phil', 95),
(null, 'Mr. Muhammad Arshed Rashed', 'Mathematics', 'Asso.Prof/HOD', 'M.Sc', 96),
(null, 'Mr. Ahmad Saleem', 'Mathematics', 'Asso. Prof', 'M.Sc', 97),
(null, 'Ms. Nazia Afzal', 'Mathematics', 'Asso. Prof', 'M.Phil', 98),
(null, 'Dr. Qaisar Mehmood', 'Mathematics', 'Asstt.Prof', 'Ph.D', 99),
(null, 'Mr. Tariq Sharif', 'Mathematics', 'Asstt.Prof', 'M.Phil', 100),
(null, 'Mr. Muhammad Ikram', 'Mathematics', 'Asstt.Prof', 'M.Phil', 101),
(null, 'Mr. Imran Nadeem', 'Mathematics', 'Asstt.Prof', 'M.Phil', 102),
(null, 'Mr. Javed Ali', 'Mathematics', 'Asstt.Prof', 'M.Sc', 103),
(null, 'Malka Shah Bano', 'Mathematics', 'Asstt.Prof', 'M.Phil', 104),
(null, 'Ms. Tanzeela Afzal', 'Mathematics', 'Asstt.Prof', '', 105),
(null, 'Mr. Abdul Aziz', 'Mathematics', 'Lecturer', 'M.Phil', 106),
(null, 'Mr. Muhammad Khurram Gill', 'Mathematics', 'Lecturer', '', 107),
(null, 'Ms. Ayesha Liaqat', 'Mathematics', 'Lecturer', 'M.Phil', 108),
(null, 'Dr. Muhammad Ahmer Khan', 'Persian', 'Lecturer', '', 109),
(null, 'Dr. Kaiser Mahmood', 'Philosophy', 'Professor/HOD', '', 110),
(null, 'Mr. Muhammad Tariq Sheikh', 'Physics', 'Asso Prof/HOD', '', 111),
(null, 'Dr. Abdul Rashid', 'Physics', 'Professor (Personal to him)', 'Ph.D', 112),
(null, 'Mrs. Noureen Azam', 'Physics', 'Professor', 'M.Phil', 113),
(null, 'Mst. Majida Choudry', 'Physics', 'Asso. Prof', 'M.Phil', 114),
(null, 'Mr. Jamil Ahmad', 'Physics', 'Asso. Prof.', 'M.Phil', 115),
(null, 'Mr. Nadeem Ahmad Ashrafi', 'Physics', 'Asso. Prof.', 'M.Phil', 116),
(null, 'Dr. Muhammad Zubair', 'Physics', 'Asso. Prof.', 'Ph.D', 117),
(null, 'Dr. Jamil Ahmad Siddiqui', 'Physics', 'Asso. Prof.', 'Ph.D', 118),
(null, 'Dr. Waris Ali', 'Physics', 'Asso. Prof.', 'Ph.D', 119),
(null, 'Mr. Attiq-us-Salam', 'Physics', 'Asso. Prof', 'M.Phil', 120),
(null, 'Mr. Abid Hussan', 'Physics', 'Asstt.Prof', 'M.Phil', 121),
(null, 'Mr. Zahid Khan', 'Physics', 'Asstt.Prof', 'M.Phil', 122),
(null, 'Mr. Muhammad Asghar', 'Physics', 'Asstt.Prof', 'M.Sc', 123),
(null, 'Mr. Muhammad Akmal', 'Physics', 'Asstt.Prof', '', 124),
(null, 'Mr. Muhammad Shafiq Anjum', 'Physics', 'Asstt.Prof', '', 125),
(null, 'Mr. M. Salman Azhar', 'Physics', 'Lecturer', 'M.Phil', 126),
(null, 'Muhammad Ismail', 'Physics', 'Lecturer', 'M.Phil', 127),
(null, 'Mr. Muhammad Bilal Bhatti', 'Physics', 'Lecturer', 'M.Phil', 128),
(null, 'Dr. Saba Maqsood', 'Physics', 'Lecturer', 'Ph.D', 129),
(null, 'Ms. Rabia Shah', 'Physics', 'Lecturer', 'M.Phil', 130),
(null, 'Dr. Rehman Gul Khan', 'Political Science', 'Asso. Prof', '', 131),
(null, 'Mr. Majeeb-ul-Islam', 'Political Science', 'Asso.Prof', 'M.A', 132),
(null, 'Mr. Abdul Rasheed', 'Political Science', 'Asstt.Prof', 'M.A', 133),
(null, 'Mr. Qamar Abbas', 'Political Science', 'Asstt. Prof.', 'M.Phil', 134),
(null, 'Ms. Khush Bakhat Bajwa', 'Political Science', 'Asstt.Prof', 'M.Phil', 135),
(null, 'Mr. Imran Majeed', 'Political Science', 'Asstt.Prof', 'M.Phil', 136),
(null, 'Mr. Qasim Ali', 'Political Science', 'Asstt.Prof', 'M.Phil', 137),
(null, 'Ms. Rakhshanda Iqbal', 'Political Science', 'Asstt.Prof', '', 138),
(null, 'Dr. Ambreen Aman', 'Political Science', 'Asstt.Prof', '', 139),
(null, 'Mr. Nayyar Ul Hassan', 'Political Science', 'Lecturer', 'M.Phil', 140),
(null, 'Ms. Amtal Saba', 'Psychology', 'Asstt.Prof/HOD', '', 141),
(null, 'Mr. Fakher Elahi', 'Psychology', 'Asstt.Prof', 'M.Phil', 142),
(null, 'Mr. Muhammad Ali', 'Psychology', 'Lecturer', 'M.S', 143),
(null, 'Mr. Adeel Sarwar', 'Psychology', 'Lecturer', 'M.S', 144),
(null, 'Ms. Sana Wakeel', 'Psychology', 'Lecturer', '', 145),
(null, 'Mr. Muhammad Aslam', 'Sociology', 'Asso.Prof/HOD', 'M.A', 146),
(null, 'Mr. Abdul Aziz Taga', 'Sociology', 'Asso. Prof', 'M.Phil', 147),
(null, 'Dr. Rabia Safdar', 'Sociology', 'Asstt.Prof', 'Ph.D', 148),
(null, 'Dr. Nadeem Abbas', 'Sociology', 'Lecturer', 'Ph.D', 149),
(null, 'Mr. Ahsan Ghafoor', 'Sociology', 'Lecturer', 'M.Phil', 150),
(null, 'Dr. Bushra Mehmood', 'Sociology', 'Lecturer', 'Ph.D', 151),
(null, 'Ms. Marhaba Rana', 'Sociology', 'Lecturer', 'M.Phil', 152),
(null, 'Ms. Noor Fatima', 'Sociology', 'Lecturer', 'M.Phil', 153),
(null, 'Mr. Muhammad Amer Nazir', 'Statistics', 'Asso.Prof/HOD', '', 154),
(null, 'Mr. Amjad Ali Chaudhry', 'Statistics', 'Asso. Prof', 'M.Sc', 155),
(null, 'Mr. Muhammad Sabir Ch', 'Statistics', 'Asso. Prof', 'M.Sc', 156),
(null, 'Malik Muhammad Qasim', 'Statistics', 'Asstt.Prof', 'M.Sc', 157),
(null, 'Dr. Muhammad Zahid Rasheed', 'Statistics', 'Asstt.Prof', 'Ph.D', 158),
(null, 'Dr. Azam Zaka', 'Statistics', 'Asstt.Prof', 'Ph.D', 159),
(null, 'Mr. Fayyaz Labha', 'Statistics', 'Asstt.Prof', 'M.Phil', 160),
(null, 'Mr. Abdur Raheem', 'Statistics', 'Asstt.Prof', '', 161),
(null, 'Dr. Muhammad Naeem', 'Urdu', 'Professor/HOD', '', 162),
(null, 'Mr. Talat Rashid', 'Urdu', 'Asso.Prof', 'M.Phil', 163),
(null, 'Dr. Sohail Mumtaz', 'Urdu', 'Asso.Prof', 'Ph.D', 164),
(null, 'Mr. Ghulam Sabir', 'Urdu', 'Asso.Prof.', 'M.Phil', 165),
(null, 'Mr. Muhammad Asif', 'Urdu', 'Asstt.Prof', 'M.Phil', 166),
(null, 'Dr. M. Farooq', 'Urdu', 'Asstt.Prof', 'Ph.D', 167),
(null, 'Dr. Abeera Shahid', 'Urdu', 'Lecturer', 'Ph.D', 168),
(null, 'Mrs. Naveed Akhter', 'Zoology', 'Professor/HOD', 'M.Phil', 169),
(null, 'Dr. Syed Shahid Imran Bokhari', 'Zoology', 'Asstt.Prof', 'Ph.D', 170),
(null, 'Mrs. Mariam Zaheer', 'Zoology', 'Asstt.Prof', 'M.Phil', 171),
(null, 'Dr. Malik Adil Abbas', 'Zoology', 'Asstt.Prof', 'Ph.D', 172),
(null, 'Mr. Sabir Javed', 'Zoology', 'Asstt.Prof', 'M.Phil', 173),
(null, 'Dr. Iram Aziz', 'Zoology', 'Asstt.Prof', 'Ph.D', 174),
(null, 'Ms. Qurat-Ul-Ain', 'Zoology', 'Asstt.Prof', 'M.Phil', 175),
(null, 'Mst. Bushra Younas', 'Zoology', 'Lecturer', 'M.Phil', 176);
update public.teachers t set name = s.name, department = s.department, designation = s.designation, qualification = s.qualification, sort_no = s.sort_no
  from staff s where s.email is not null and t.email = s.email;
insert into public.teachers (email, name, department, designation, qualification, sort_no, added_by)
  select s.email, s.name, s.department, s.designation, s.qualification, s.sort_no, 'staff list'
  from staff s where s.email is null or not exists (select 1 from public.teachers t where t.email = s.email);
commit;
notify pgrst, 'reload schema';
select count(*) total, count(email) with_login, count(distinct department) departments from public.teachers;

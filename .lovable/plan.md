

# UnityClass — Rebuilt & Fixed

A classroom management app with proper role-based access, working class creation, and a weekly timetable.

## 1. Authentication & User Profiles
- Email/password sign up and sign in
- Profile creation on signup (name, avatar)
- Lovable Cloud backend with Supabase auth

## 2. Role System (4 tiers)
- **Roles**: Super Admin, Admin, Teacher, Student
- Roles stored in a separate `user_roles` table (secure, no privilege escalation)
- New users default to "Student" role
- **Super Admin** can view all users and change anyone's role from a user management panel

## 3. Class Creation (Fixed)
- Admins and Super Admins can create classes with: name, subject, description, assigned teacher
- Classes are stored in the database with proper RLS policies
- Teachers can view their assigned classes; Students can view classes they're enrolled in
- Enrollment system: Admins assign students to classes

## 4. Weekly Timetable
- Grid view: days of the week (columns) × time slots (rows)
- Each cell shows the class, teacher, and room/location
- **Any Admin role** (Super Admin or Admin) can create and edit timetable entries
- Teachers and Students see a read-only view of their relevant schedule
- Filter by class or teacher

## 5. Dashboard
- Role-aware home screen after login
- Super Admin/Admin: see overview of classes, users, and timetable management links
- Teacher: see assigned classes and their weekly schedule
- Student: see enrolled classes and their weekly schedule

## 6. User Management (Super Admin)
- List all users with their current roles
- Change any user's role via dropdown
- Search/filter users by name or role


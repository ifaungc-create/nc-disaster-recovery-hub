// Error messages that come from the server or the data layer in English. They are shown with t(message),
// so listing them here (with tk) puts them in en.js and requires a Spanish translation in es.js.
import { tk } from './index.js';
export const ERRORS = [
  tk('Enter a valid email address.'), tk('Password must be at least 8 characters.'), tk('Please enter your name (a first name is fine).'),
  tk('Choose how you are using this app.'), tk('Please read and accept the privacy notice.'), tk('Enter the case or claim number.'),
  tk('Write something in the note first.'), tk('Enter who you were referred to.'), tk('Unknown record type.'), tk('Add your organization or your name.'),
  tk('Choose what kind of record this is.'), tk('Choose a category.'), tk('Choose a county, or Statewide.'), tk('Enter a name or title.'),
  tk('Enter the phone number using digits only (dashes and spaces are fine).'), tk('The link must start with https://'),
  tk('Enter a source link (https://) where an admin can check this information.'), tk('Add a phone number, a link or a description.'),
  tk('This device cannot share its location. Enter a ZIP code or city instead.'), tk('Location permission was not given. You can enter a ZIP code or city instead.'),
  tk('Could not get your location. Enter a ZIP code or city instead.'), tk('Your location does not look like it is in North Carolina. You can pick a county instead.'),
  tk('This needs the online version of the app (server storage).'), tk('An account with that email already exists on this device. Try signing in.'),
  tk('Email or password is incorrect.'), tk('Not signed in'), tk('Not found'), tk('Only responder accounts can create share cards.'),
  tk('That code was not found, has expired, or was turned off by the responder. Check the code and try again.'), tk('Please confirm you want to save this information.'),
  tk('Something went wrong. Please try again.'), tk('The live map check is not available right now.'), tk('An account with that email already exists. Try signing in.'),
  tk('Bad request'), tk('Forbidden'), tk('Password is too long (256 characters max).'), tk('Please sign in again.'), tk('Please try again.'), tk('Request too large.'),
  tk('That code was not found, has expired, or was turned off.'), tk('This is for disaster responder accounts.'), tk('Too many notes.'),
  tk('You have many records waiting for review. Please wait for an admin to review them.'), tk('You have reached the share card limit. Delete your account data or contact support.'),
  tk('Hotel search is not available right now.'), tk('Location is outside the North Carolina area.'), tk('The live map service did not answer. The offline list above still works.'),
  tk('The service is not configured yet.'),
  tk('Choose up to 10 counties.'), tk('Choose statewide alerts or at least one county.'), tk('This browser gave an invalid push address.'), tk('This browser\'s push service is not supported.'),
  tk('This browser gave invalid push keys.'), tk('Choose statewide or a county.'), tk('The link must start with https:// or /'), tk('Please confirm before sending.'), tk('Administrators only.'), tk('Too many attempts. Please wait a few minutes and try again.'),
  tk('Choose statewide or at least one county.'), tk('That code is not valid or has expired. Ask an administrator for a new one.'), tk('This account cannot claim admin access.'),
  tk('Nothing was changed.'), tk('Please confirm before deleting.'), tk('To delete your own account, use Settings.'), tk('The email you typed does not match this account.'),
  tk('You are signed in. To change your own password, use the admin recovery code on the sign-in page.'),
  tk('Could not reach the server. Check your internet connection and try again. If it keeps happening, close the app completely and open it again.'),
  tk('Signing in does not work inside Google Translate. Open the app directly at disaster-resources.app and choose Español with the language button.'),
  tk('You are viewing this page through Google Translate. Signing in and accounts only work on the app itself.'), tk('Open the app to sign in'),
];
// Labels defined in data/shared.js (also used by the server, so they stay English there) and shown with t(label).
export const LABELS = [
  tk('Person affected by a disaster'), tk('Disaster responder'), tk('Administrator'),
  tk('Red Cross'), tk('FEMA'), tk('Insurance claim'), tk('SBA'), tk('NCEM'), tk('Other'),
  tk('Not started'), tk('Contacted'), tk('Waiting'), tk('Done'),
  tk('Organization'), tk('Service'), tk('Shelter'), tk('Phone number'), tk('Link'),
  tk('Housing & shelter'), tk('Relocating'), tk('Free legal help'), tk('Jobs & income'), tk('Replacing documents'), tk('Relief organizations'), tk('Fire reports'), tk('Insurance'), tk('Board-up & cleanup'),
  tk('Combination'), tk('Paid (career)'), tk('Volunteer'), tk('County district'), tk('City/town district'), tk('State school'),
  tk('Waiting for approval'), tk('Approved'), tk('Not approved'), tk('Access removed'), tk('Statewide'),
];
// Text from config.js.
export const CONFIG_TEXT = [tk('A project of C4I Veteran Services Corp.'), tk('Help after fires, floods and hurricanes in North Carolina. A project of C4I Veteran Services Corp.')];
// Crisis bar (content/resources.js).
export const CRISIS_TEXT = [tk('Emergency'), tk('Crisis line'), tk('NC 211 help'), tk('Red Cross'), tk('Call 911 for emergencies'), tk('Call 988 Suicide and Crisis Lifeline (you can also text 988)'), tk('Call NC 211 for shelter, food and local help. If 211 does not connect, call 1-888-892-1162'), tk('Call the American Red Cross, 1-800-733-2767')];
// Adding administrators, temporary passwords, forced password change (api.js).
export const ADMIN_ERRORS = [tk('You must set a new password before you continue.'), tk('This temporary password has expired. Ask an administrator for a new one.'), tk('You are the only administrator. Add another administrator before you delete your account.'), tk('The temporary password is not correct.'), tk('Your current password is not correct.'), tk('Your new password must be different from the temporary password.'), tk('Your new password must be different from your current password.'), tk('This account is an administrator. Remove its administrator rights first (Administrators tab).'), tk('This person is already an administrator.'), tk('Someone else changed this at the same time. Please try again.'), tk('You cannot remove your own administrator rights.'), tk('This account is not an administrator.'), tk('You cannot remove the last administrator.'), tk('To change your own password, sign out and use "Forgot your password?".')];

import { usersRepo } from '../../repositories/users.repo.js';
import { getGraphConfig } from './settings.js';
import { acquireGraphAccessToken } from './transport.js';
import { logger } from '../../logger.js';

export interface DirectoryUser {
  id: string;
  name: string;
  email: string;
  role: string;
  title: string;
  department?: string;
  initials: string;
}

type GraphUser = {
  id: string;
  displayName?: string;
  mail?: string | null;
  userPrincipalName?: string;
  jobTitle?: string | null;
  department?: string | null;
};

function roleFromJobTitle(jobTitle: string | null | undefined): string {
  const title = (jobTitle || '').toLowerCase();
  if (title.includes('hod') || title.includes('head')) return 'hod';
  if (title.includes('lead') || title.includes('manager')) return 'lead';
  if (title.includes('coordinator')) return 'coordinator';
  return 'stakeholder';
}

/**
 * Searches the Encalm corporate directory via Microsoft Graph API
 * (User.Read.All). Directory people are saved as local users so tag chips and
 * notifications resolve; someone who already has a local account keeps it.
 */
export async function searchEncalmDirectory(searchQuery: string = ''): Promise<DirectoryUser[]> {
  const cfg = getGraphConfig();
  if (!cfg.tenantId || !cfg.clientId || !cfg.clientSecret) {
    return [];
  }

  try {
    const accessToken = await acquireGraphAccessToken(cfg);
    const cleanQuery = encodeURIComponent(searchQuery.trim().replace(/['"]/g, ''));

    let url =
      'https://graph.microsoft.com/v1.0/users?$top=30&$select=id,displayName,mail,userPrincipalName,jobTitle,department';
    if (cleanQuery) {
      url += `&$filter=startswith(displayName,'${cleanQuery}') or startswith(mail,'${cleanQuery}') or startswith(userPrincipalName,'${cleanQuery}')`;
    }

    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      logger.warn(`[Microsoft Graph Directory] Query failed (${res.status}): ${errText}`);
      return [];
    }

    const data = (await res.json()) as { value?: GraphUser[] };
    const localByEmail = new Map(usersRepo.listDirectory().map((u) => [u.email?.toLowerCase(), u]));

    return (data.value || [])
      .filter((u) => u.displayName && (u.mail || u.userPrincipalName))
      .map((u) => {
        const email = (u.mail || u.userPrincipalName || '').toLowerCase().trim();
        const name = (u.displayName || '').trim();
        const parts = name.split(/\s+/);
        const initials = ((parts[0]?.[0] || '') + (parts[parts.length - 1]?.[0] || '')).toUpperCase() || 'U';
        const local = localByEmail.get(email);

        const user: DirectoryUser = {
          id: local ? local.id : `azure-${u.id}`,
          name: local ? local.name : name,
          email,
          role: local ? local.role : roleFromJobTitle(u.jobTitle),
          title: local ? local.title : u.jobTitle || u.department || 'Encalm Team',
          department: u.department || undefined,
          initials: local ? local.initials : initials,
        };
        try {
          usersRepo.upsertDirectoryUser({ ...user, name });
        } catch (err) {
          logger.warn({ err }, '[Microsoft Graph Directory] Could not save directory user');
        }
        return user;
      });
  } catch (err) {
    logger.error({ err }, '[Microsoft Graph Directory Error]');
    return [];
  }
}

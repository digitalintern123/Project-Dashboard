import type { IssueStatus } from '@/data/projects';
import { AlertTriangle, Clock, Activity, CheckCircle2, type LucideIcon } from 'lucide-react';

export interface IssueStatusTheme {
  status: IssueStatus;
  label: string;
  dotColor: string;
  badgeClass: string;
  selectClass: string;
  cardClass: string;
  iconBoxClass: string;
  icon: LucideIcon;
  stepIndex: number;
  stepPercent: number;
  description: string;
}

export function getIssueStatusTheme(
  status: IssueStatus = 'Open',
  severity: 'High' | 'Medium' | 'Low' = 'Medium',
): IssueStatusTheme {
  switch (status) {
    case 'Under review':
      return {
        status: 'Under review',
        label: 'Under review',
        dotColor: '#8f9a2e',
        badgeClass: 'bg-[#f4f7dc] text-[#69741e] border border-[#d8e2a3]',
        selectClass: 'border-[#d8e2a3] bg-[#fbfdf2] text-[#69741e] font-bold focus:ring-[#8f9a2e]',
        cardClass: 'border-[#dce4b5] bg-[#fafcf4] hover:border-[#cbdb99]',
        iconBoxClass: 'bg-[#f4f7dc] text-[#69741e]',
        icon: Clock,
        stepIndex: 1,
        stepPercent: 35,
        description: 'Under review & evaluation',
      };
    case 'Action in progress':
      return {
        status: 'Action in progress',
        label: 'Action in progress',
        dotColor: '#25886d',
        badgeClass: 'bg-[#e6f4ed] text-[#22795e] border border-[#aedec7]',
        selectClass: 'border-[#aedec7] bg-[#f4faf7] text-[#22795e] font-bold focus:ring-[#25886d]',
        cardClass: 'border-[#b7ded1] bg-[#f5fbf8] hover:border-[#9ed5c2]',
        iconBoxClass: 'bg-[#e6f4ed] text-[#22795e]',
        icon: Activity,
        stepIndex: 2,
        stepPercent: 65,
        description: 'Mitigation action underway',
      };
    case 'Resolved':
      return {
        status: 'Resolved',
        label: 'Resolved',
        dotColor: '#206e57',
        badgeClass: 'bg-[#dff0e6] text-[#1e6b52] border border-[#8dcca9] font-bold',
        selectClass: 'border-[#8dcca9] bg-[#eff8f3] text-[#1e6b52] font-extrabold focus:ring-[#206e57]',
        cardClass: 'border-[#a7dcc5] bg-[#f2f9f5] hover:border-[#83cca8]',
        iconBoxClass: 'bg-[#dff0e6] text-[#1e6b52]',
        icon: CheckCircle2,
        stepIndex: 3,
        stepPercent: 95,
        description: 'Mitigated & resolved',
      };
    case 'Closed':
      return {
        status: 'Closed',
        label: 'Closed',
        dotColor: '#175341',
        badgeClass: 'bg-[#d2ebe0] text-[#155741] border border-[#72bc97] font-bold',
        selectClass: 'border-[#72bc97] bg-[#e8f5ee] text-[#155741] font-extrabold focus:ring-[#175341]',
        cardClass: 'border-[#92d0b4] bg-[#edf7f2] hover:border-[#6fbe98]',
        iconBoxClass: 'bg-[#d2ebe0] text-[#155741]',
        icon: CheckCircle2,
        stepIndex: 4,
        stepPercent: 100,
        description: 'Formally closed & verified',
      };
    case 'Open':
    default:
      if (severity === 'High') {
        return {
          status: 'Open',
          label: 'Open',
          dotColor: '#b2473d',
          badgeClass: 'bg-[#fae5e1] text-[#b2473d] border border-[#f0c8c2]',
          selectClass: 'border-[#f0c8c2] bg-[#fff8f7] text-[#b2473d] font-bold focus:ring-[#b2473d]',
          cardClass: 'border-[#f0c8c2] bg-[#fff8f7] hover:border-[#e8aba2]',
          iconBoxClass: 'bg-[#fae5e1] text-[#b2473d]',
          icon: AlertTriangle,
          stepIndex: 0,
          stepPercent: 15,
          description: 'Open critical issue',
        };
      }
      return {
        status: 'Open',
        label: 'Open',
        dotColor: '#9a711f',
        badgeClass: 'bg-[#f8edcf] text-[#9a711f] border border-[#eadcb1]',
        selectClass: 'border-[#eadcb1] bg-[#fffdf6] text-[#9a711f] font-bold focus:ring-[#9a711f]',
        cardClass: 'border-[#eadcb1] bg-[#fffcf4] hover:border-[#dfcda0]',
        iconBoxClass: 'bg-[#f8edcf] text-[#9a711f]',
        icon: AlertTriangle,
        stepIndex: 0,
        stepPercent: 15,
        description: 'Open issue awaiting review',
      };
  }
}

export const issueStatusOptions: { status: IssueStatus; label: string; prefix: string }[] = [
  { status: 'Open', label: 'Open', prefix: '●' },
  { status: 'Under review', label: 'Under review', prefix: '●' },
  { status: 'Action in progress', label: 'Action in progress', prefix: '●' },
  { status: 'Resolved', label: 'Resolved', prefix: '✓' },
  { status: 'Closed', label: 'Closed', prefix: '✓' },
];

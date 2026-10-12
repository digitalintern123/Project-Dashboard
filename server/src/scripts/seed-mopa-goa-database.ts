import { db, initDatabase } from '../db/database.js';
import { saveDatabaseSnapshot } from '../utils/backup.js';

export function seedMopaGoaHotelToDatabase() {
  initDatabase();

  const projectId = 'mopa-goa-hotel';

  const specification = {
    projectType: 'Hotel',
    terminal: 'Mopa, Goa',
    units: '220 Keys',
    floor: 'Basement, Ground, Mezz-1 & 2, 1st floor, 2nd to 6th Guest floor',
    area: '20,000 SQ.M. / 2,15,280 SQ.FT.',
    capacity: '220 Keys • 109 Car Parks • 9 Elevators',
    scope:
      'Plot Area: 8,619 SQ.M. (2.13 Acre), FAR: 15,156 SQ.M. (1,63,139 SQ.FT.), Built-up Area: 20,000 SQ.M. (2,15,280 SQ.FT.), 220 Keys across Basement, Ground, Mezz-1 & 2, 1st floor, 2nd to 6th Guest floors with Ball Room, ADD, Lounge Bar, Gym, Health SPA, Function Terrace, Swimming Pool & MEPF infrastructure.',
    customFields: [
      { label: 'FAR Area', value: '15,156 SQ.M. / 1,63,139 SQ.FT.' },
      { label: 'Car Parking', value: '109 Nos. ((36 X 2) stack parking, 3 single, 34 ground surface)' },
      { label: 'Elevators', value: '9 Nos. (6 Guest Lifts + 3 Service Lifts)' },
      { label: 'STP Capacity', value: '140 KLD (MBBR Technology)' },
      { label: 'Hot Water', value: 'Hot Generation System' },
      {
        label: 'HVAC Chillers',
        value: 'Chilled water - 3 X 300TR (2working + 1standby) rotary screw chillers at Terrace Floor',
      },
      { label: 'Cooling Towers', value: 'Cooling Tower 375 TR X 2no. At Terrace Floor' },
      { label: 'Electrical Sub-station', value: '2 X 800KVA compact type sub-station at Ground Floor level' },
      { label: 'DG Power Backup', value: '2 X 750 + 1 X 500 KVA DG for 100% power backup in Basement Floor' },
      { label: 'Main Electrical Panel', value: 'Main electrical panel room in Basement Floor' },
    ],
    areaProgram: {
      summary: {
        plotAreaSqm: 8619,
        plotAreaSqft: 92775,
        plotAreaAcres: 2.13,
        builtUpAreaSqm: 20000,
        builtUpAreaSqft: 215280,
        numberOfFloorsDescription: 'Basement, Ground, Mezz-1 & 2, 1st floor, 2nd to 6th Guest floor',
        totalRoomKeys: 220,
        totalBays: 220,
        standardRoomSizeSqm: 28,
        numberOfElevators: 9,
        elevatorRemarks: '6 Guest Lifts + 3 Service Lifts',
        generalRemarks: '218 Std. Guest Room, 4 Executive suites, 4 Presidential suites (Total 220 Keys)',
      },
      fohAreas: {
        groundFloor: [
          {
            sNo: 1,
            floor: 'Ground Floor',
            description: 'Ball Room',
            areaSqm: 465,
            areaSqft: 5005,
            capacityPax: '300',
            remarks: 'Large ballroom banquet facility',
          },
          {
            sNo: 2,
            floor: 'Ground Floor',
            description: 'Pre-function',
            areaSqm: 217,
            areaSqft: 2336,
            remarks: 'Grand pre-event registration foyer',
          },
          {
            sNo: 3,
            floor: 'Ground Floor',
            description: 'ADD (All Day Dining)',
            areaSqm: 610,
            areaSqft: 6566,
            capacityPax: '174',
            remarks: 'Main all day dining restaurant',
          },
          {
            sNo: 4,
            floor: 'Ground Floor',
            description: 'Lounge BAR',
            areaSqm: 115,
            areaSqft: 1238,
            capacityPax: '23',
            remarks: 'Premium lounge & cocktail bar',
          },
          {
            sNo: 5,
            floor: 'Ground Floor',
            description: 'Kitchen',
            areaSqm: 304,
            areaSqft: 3272,
            remarks: 'Main commercial kitchen and banqueting support',
          },
        ],
        groundFloorSubtotal: { areaSqm: 1711, areaSqft: 18417 },
        secondFloor: [
          {
            sNo: 1,
            floor: '1st Floor',
            description: 'GYM',
            areaSqm: 59,
            areaSqft: 635,
            remarks: 'Modern fitness studio & workout floor',
          },
          {
            sNo: 2,
            floor: '1st Floor',
            description: 'Health SPA',
            areaSqm: 139,
            areaSqft: 1496,
            remarks: '1no. Relaxation Room, 2no. Of treatment rooms & SPA BOH area',
          },
          {
            sNo: 3,
            floor: '1st Floor',
            description: 'Function Terrace',
            areaSqm: 325,
            areaSqft: 3498,
            capacityPax: '34',
            remarks: 'Pool BAR Counter, semi covered seating',
          },
          {
            sNo: 4,
            floor: '1st Floor',
            description: 'Swimming Pool',
            areaSqm: 250,
            areaSqft: 2691,
            remarks: "Swimming Pool, Kid's Pool",
          },
        ],
        secondFloorSubtotal: { areaSqm: 773, areaSqft: 8320 },
        grandSubtotal: { areaSqm: 2484, areaSqft: 26737 },
      },
      floorWiseBua: {
        items: [
          {
            sNo: 1,
            floor: 'Basement Floor',
            areaSqm: 2800,
            areaSqft: 30139,
            remarks: 'Parking (75 cars), 100% DG backup, Main electrical panel room, STP (140 KLD)',
          },
          {
            sNo: 2,
            floor: 'Ground Floor',
            areaSqm: 3200,
            areaSqft: 34445,
            remarks:
              'Main Lobby, Ball Room (300 Pax), Pre-function, ADD (174 Pax), Lounge Bar (23 Pax), Kitchen, Sub-station, Surface parking',
          },
          {
            sNo: 3,
            floor: 'Mezzanine 1 Floor',
            areaSqm: 1400,
            areaSqft: 15070,
            remarks: 'Administration, engineering offices, BOH locker rooms',
          },
          {
            sNo: 4,
            floor: 'Mezzanine 2 Floor',
            areaSqm: 1400,
            areaSqft: 15070,
            remarks: 'MEP service routing, storage, banquet back-of-house',
          },
          {
            sNo: 5,
            floor: '1st Floor',
            areaSqm: 2200,
            areaSqft: 23681,
            remarks: 'Gym, Health SPA, Function Terrace (Pool Bar, 34 Pax), Swimming Pool & Kid’s pool',
          },
          { sNo: 6, floor: '2nd Guest Floor', areaSqm: 1800, areaSqft: 19375, remarks: '44 Guest keys' },
          { sNo: 7, floor: '3rd Guest Floor', areaSqm: 1800, areaSqft: 19375, remarks: '44 Guest keys' },
          { sNo: 8, floor: '4th Guest Floor', areaSqm: 1800, areaSqft: 19375, remarks: '44 Guest keys' },
          { sNo: 9, floor: '5th Guest Floor', areaSqm: 1800, areaSqft: 19375, remarks: '44 Guest keys' },
          {
            sNo: 10,
            floor: '6th Guest Floor',
            areaSqm: 1700,
            areaSqft: 18299,
            remarks: '44 Keys (4 Executive Suites, 4 Presidential Suites)',
          },
          {
            sNo: 11,
            floor: 'Terrace Floor',
            areaSqm: 100,
            areaSqft: 1076,
            remarks: '3x300TR screw chillers, 2x375TR cooling towers, lift machine room',
          },
        ],
        subtotal: { areaSqm: 20000, areaSqft: 215280 },
      },
      roomConfiguration: {
        items: [
          { sNo: 1, floor: '2nd Guest Floor', keys: 44, bays: 44, remarks: '44 Standard Deluxe Rooms' },
          { sNo: 2, floor: '3rd Guest Floor', keys: 44, bays: 44, remarks: '44 Standard Deluxe Rooms' },
          { sNo: 3, floor: '4th Guest Floor', keys: 44, bays: 44, remarks: '44 Standard Deluxe Rooms' },
          { sNo: 4, floor: '5th Guest Floor', keys: 44, bays: 44, remarks: '44 Standard Deluxe Rooms' },
          {
            sNo: 5,
            floor: '6th Guest Floor',
            keys: 44,
            bays: 44,
            remarks: '36 Standard Rooms, 4 Executive Suites, 4 Presidential Suites',
          },
        ],
        totalKeys: 220,
        totalBays: 220,
      },
    },
    areaSheet: {
      slNo: 2,
      section: 'HOTELS',
      status: 'In Design',
      areaSqft: 215280,
      areaSqm: 20000,
    },
  };

  const projectRecord = {
    id: projectId,
    name: 'Mopa Goa Hotel',
    location: 'Goa',
    category: 'Hotel',
    code: 'MOP-HTL-26',
    health: 'On track',
    status: 'In Design',
    progress: 18,
    target_date: '2027-09-30',
    target_label: '30 Sep 2027',
    aop: 2450000000,
    awarded: 580000000,
    spent: 24000000,
    projected_cost: 2450000000,
    area: '20,000 SQ.M. / 2,15,280 SQ.FT.',
    pax_keys: '220 Keys • 109 Car Parks',
    next_milestone: 'Detailed Design & MEPF Finalization',
    next_milestone_date: '2026-12-15',
    lead_id: 'user-chinmay-saxena',
    start_date: '2025-06-01',
    last_updated: new Date().toISOString(),
    specification_json: JSON.stringify(specification),
    template_id: 'hotel',
  };

  const phases = [
    {
      id: `${projectId}-phase-1`,
      project_id: projectId,
      name: 'Feasibility & Brief',
      status: 'complete',
      progress: 100,
      owner: 'PMO',
      order_index: 0,
      planned_start: '2025-06-01',
      planned_finish: '2025-08-31',
      actual_finish: '2025-08-25',
      work_completed:
        'Site boundary survey, soil investigation, traffic impact study and 220-key operator brief ratified.',
      next_action: 'Proceed to statutory filings',
      decision_required: 'Operator architectural sign-off completed.',
    },
    {
      id: `${projectId}-phase-2`,
      project_id: projectId,
      name: 'Design Development & MEPF',
      status: 'active',
      progress: 55,
      owner: 'Design',
      order_index: 1,
      planned_start: '2025-09-01',
      planned_finish: '2026-03-31',
      actual_finish: null,
      work_completed:
        'Architectural schematic drawings, structural transfer slab layout, and terrace MEPF chillers layout frozen.',
      next_action: 'Finalize BOQ and tender packages for substructure and MEPF packages.',
      decision_required: 'Confirmation on façade material and chiller energy efficiency specifications.',
    },
    {
      id: `${projectId}-phase-3`,
      project_id: projectId,
      name: 'Approvals & Statutory Clearances',
      status: 'active',
      progress: 40,
      owner: 'Projects',
      order_index: 2,
      planned_start: '2025-10-01',
      planned_finish: '2026-06-30',
      actual_finish: null,
      work_completed: 'Environmental Clearance (EC) application and Airport Authority Height NOC submitted.',
      next_action: 'Attend state pollution control board committee review.',
      decision_required: 'State environmental committee compliance response.',
    },
    {
      id: `${projectId}-phase-4`,
      project_id: projectId,
      name: 'Procurement & Contracts',
      status: 'upcoming',
      progress: 0,
      owner: 'Sourcing',
      order_index: 3,
      planned_start: '2026-04-01',
      planned_finish: '2026-09-30',
      actual_finish: null,
      work_completed: null,
      next_action: 'Issue RFP for general civil contractor and long-lead HVAC chillers.',
      decision_required: null,
    },
    {
      id: `${projectId}-phase-5`,
      project_id: projectId,
      name: 'Construction & Fit-out',
      status: 'upcoming',
      progress: 0,
      owner: 'Projects',
      order_index: 4,
      planned_start: '2026-07-01',
      planned_finish: '2027-09-30',
      actual_finish: null,
      work_completed: null,
      next_action: 'Site mobilization, excavation, and basement diaphragm wall construction.',
      decision_required: null,
    },
  ];

  const milestones = [
    {
      id: `${projectId}-ms-1`,
      project_id: projectId,
      title: 'Architectural Concept & 220-Key Brief Approval',
      date: '2025-08-25',
      status: 'complete',
      stage: 'Design',
      owner: 'PMO',
      approval_required: 1,
      approval_status: 'Approved',
      completed_date: '2025-08-25',
      order_index: 0,
    },
    {
      id: `${projectId}-ms-2`,
      project_id: projectId,
      title: 'Detailed Design & MEPF Finalization',
      date: '2026-12-15',
      status: 'upcoming',
      stage: 'Design',
      owner: 'Design',
      approval_required: 1,
      approval_status: 'Pending',
      order_index: 1,
    },
    {
      id: `${projectId}-ms-3`,
      project_id: projectId,
      title: 'Statutory Height & Environmental Clearances',
      date: '2026-05-31',
      status: 'upcoming',
      stage: 'Approvals',
      owner: 'Projects',
      approval_required: 1,
      approval_status: 'Pending',
      order_index: 2,
    },
    {
      id: `${projectId}-ms-4`,
      project_id: projectId,
      title: 'Substructure & Basement Completion',
      date: '2026-11-30',
      status: 'upcoming',
      stage: 'Construction',
      owner: 'Projects',
      approval_required: 0,
      approval_status: 'Not required',
      order_index: 3,
    },
    {
      id: `${projectId}-ms-5`,
      project_id: projectId,
      title: 'Hotel Soft Opening & Handover',
      date: '2027-09-30',
      status: 'upcoming',
      stage: 'Opening',
      owner: 'Operations',
      approval_required: 1,
      approval_status: 'Pending',
      order_index: 4,
    },
  ];

  const issues = [
    {
      id: `${projectId}-issue-1`,
      project_id: projectId,
      title: 'HVAC Chiller Delivery Lead Time',
      detail: '3 X 300TR rotary screw chillers have a 24-week delivery lead time from overseas manufacturer.',
      severity: 'Medium',
      owner: 'Procurement Lead',
      category: 'Procurement',
      status: 'Open',
      stage: 'Design',
      impact_cost: null,
      impact_schedule:
        'Tender release must be advanced to Q1 2026 to ensure chillers arrive before terrace slab closure.',
      impact_scope: null,
      action: 'Issue advance procurement package for long-lead HVAC equipment.',
      resolution: null,
      due_date: '2026-03-31',
      date_raised: '2025-11-15',
      order_index: 0,
    },
  ];

  const tx = db.transaction(() => {
    // Upsert project
    db.prepare(
      `
      INSERT OR REPLACE INTO projects (
        id, name, location, category, code, health, status, progress, target_date, target_label,
        aop, awarded, spent, projected_cost, area, pax_keys, next_milestone, next_milestone_date,
        lead_id, start_date, last_updated, specification_json, template_id
      ) VALUES (
        @id, @name, @location, @category, @code, @health, @status, @progress, @target_date, @target_label,
        @aop, @awarded, @spent, @projected_cost, @area, @pax_keys, @next_milestone, @next_milestone_date,
        @lead_id, @start_date, @last_updated, @specification_json, @template_id
      )
    `,
    ).run(projectRecord);

    // Delete existing child records for clean insert
    db.prepare('DELETE FROM phases WHERE project_id = ?').run(projectId);
    db.prepare('DELETE FROM milestones WHERE project_id = ?').run(projectId);
    db.prepare('DELETE FROM issues WHERE project_id = ?').run(projectId);

    // Insert phases
    const insertPhase = db.prepare(`
      INSERT INTO phases (
        id, project_id, name, status, progress, owner, order_index,
        planned_start, planned_finish, actual_finish, work_completed, next_action, decision_required
      ) VALUES (
        @id, @project_id, @name, @status, @progress, @owner, @order_index,
        @planned_start, @planned_finish, @actual_finish, @work_completed, @next_action, @decision_required
      )
    `);
    for (const ph of phases) {
      insertPhase.run({
        id: ph.id,
        project_id: ph.project_id,
        name: ph.name,
        status: ph.status,
        progress: ph.progress,
        owner: ph.owner,
        order_index: ph.order_index,
        planned_start: ph.planned_start || null,
        planned_finish: ph.planned_finish || null,
        actual_finish: ('actual_finish' in ph ? ph.actual_finish : null) || null,
        work_completed: ph.work_completed || null,
        next_action: ph.next_action || null,
        decision_required: ph.decision_required || null,
      });
    }

    // Insert milestones
    const insertMilestone = db.prepare(`
      INSERT INTO milestones (
        id, project_id, title, date, status, stage, owner,
        approval_required, approval_status, completed_date, order_index
      ) VALUES (
        @id, @project_id, @title, @date, @status, @stage, @owner,
        @approval_required, @approval_status, @completed_date, @order_index
      )
    `);
    for (const ms of milestones) {
      insertMilestone.run({
        id: ms.id,
        project_id: ms.project_id,
        title: ms.title,
        date: ms.date,
        status: ms.status,
        stage: ms.stage || null,
        owner: ms.owner || null,
        approval_required: ms.approval_required ?? 0,
        approval_status: ms.approval_status || 'Not required',
        completed_date: ('completed_date' in ms ? ms.completed_date : null) || null,
        order_index: ms.order_index,
      });
    }

    // Insert issue
    const insertIssue = db.prepare(`
      INSERT INTO issues (
        id, project_id, title, detail, severity, owner, category, status,
        stage, date_raised, due_date, impact_cost, impact_schedule, impact_scope,
        action, resolution, order_index
      ) VALUES (
        @id, @project_id, @title, @detail, @severity, @owner, @category, @status,
        @stage, @date_raised, @due_date, @impact_cost, @impact_schedule, @impact_scope,
        @action, @resolution, @order_index
      )
    `);
    for (const iss of issues) {
      insertIssue.run({
        id: iss.id,
        project_id: iss.project_id,
        title: iss.title,
        detail: iss.detail || null,
        severity: iss.severity,
        owner: iss.owner,
        category: iss.category || 'Other',
        status: iss.status || 'Open',
        stage: iss.stage || null,
        date_raised: iss.date_raised || null,
        due_date: iss.due_date || null,
        impact_cost: iss.impact_cost || null,
        impact_schedule: iss.impact_schedule || null,
        impact_scope: iss.impact_scope || null,
        action: iss.action || null,
        resolution: iss.resolution || null,
        order_index: iss.order_index,
      });
    }
  });

  tx();
  console.log(`✓ Project "${projectRecord.name}" successfully seeded in database (SQLite).`);

  // Save database snapshot to server/data/portfolio-database.json
  saveDatabaseSnapshot();
}

// Auto-run if executed directly
if (process.argv[1]?.includes('seed-mopa-goa-database')) {
  seedMopaGoaHotelToDatabase();
}

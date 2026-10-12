import { db, initDatabase } from '../db/database.js';
import { saveDatabaseSnapshot } from '../utils/backup.js';

export function seedVizagHotelToDatabase() {
  initDatabase();

  const projectId = 'vizag-hotel-suites';

  const specification = {
    projectType: 'Hotel & Suites',
    terminal: 'Vizag',
    units: '156 Keys',
    floor: 'B + G + 1 + Service + 2nd to 6th Floor',
    area: '14,970 SQ.M. / 161,137 SQ.FT.',
    capacity: '156 Keys / 168 Bays',
    scope:
      'Plot Area: 8,160 SQ.M. (2.0 Acres), BUA: 14,970 SQ.M. (161,137 SQ.FT.), 156 Keys / 168 Bays across Basement, Ground, First, Service floor, and 2nd to 6th Guest Floors with Banquet, ADD, Lounge Bar, Gym, Pool & 4 Presidential Suites.',
    areaProgram: {
      summary: {
        plotAreaSqm: 8160,
        plotAreaSqft: 87834,
        plotAreaAcres: 2.0,
        builtUpAreaSqm: 14970,
        builtUpAreaSqft: 161137,
        numberOfFloorsDescription: 'Basement, Ground, First, Service floor, 2nd to 6th Guest floor',
        totalRoomKeys: 156,
        totalBays: 168,
        standardRoomSizeSqm: 27,
        numberOfElevators: 5,
        elevatorRemarks: '3 Guest Lifts and 2 Service Lifts + 1 Fire tower',
        generalRemarks: '152 Standard Rooms and 4 Presidential Suites (Total 156 Keys, 168 Bays)',
      },
      fohAreas: {
        groundFloor: [
          {
            sNo: 1,
            floor: 'Ground Floor',
            description: 'Banquet Hall',
            areaSqm: 360,
            areaSqft: 3875,
            capacityPax: '350',
            remarks: 'Large banquet facility with pillarless span',
          },
          {
            sNo: 2,
            floor: 'Ground Floor',
            description: 'Pre-function + Banquet Lobby',
            areaSqm: 297,
            areaSqft: 3197,
            remarks: 'Spacious pre-event registration foyer',
          },
          {
            sNo: 3,
            floor: 'Ground Floor',
            description: 'ADD (All Day Dining)',
            areaSqm: 330,
            areaSqft: 3552,
            capacityPax: '150',
            remarks: '100 Pax Indoor + 50 Alfresco seating',
          },
          {
            sNo: 4,
            floor: 'Ground Floor',
            description: 'Lounge BAR',
            areaSqm: 114,
            areaSqft: 1227,
            capacityPax: '37',
            remarks: '25 Pax Indoor + 12 Alfresco seating',
          },
          {
            sNo: 5,
            floor: 'Ground Floor',
            description: 'Kitchen',
            areaSqm: 335,
            areaSqft: 3606,
            remarks: 'Full commercial production & banqueting kitchen',
          },
          {
            sNo: 6,
            floor: 'Ground Floor',
            description: 'Reception Lobby',
            areaSqm: 350,
            areaSqft: 3767,
            remarks: 'Main double-height arrival lobby with reception desk',
          },
          {
            sNo: 7,
            floor: 'Ground Floor',
            description: 'Public area toilets',
            areaSqm: 130,
            areaSqft: 1399,
            remarks: 'Executive male, female, accessible restrooms',
          },
          {
            sNo: 8,
            floor: 'Ground Floor',
            description: 'Courtyard',
            areaSqm: 52,
            areaSqft: 560,
            remarks: 'Landscaped open-air light well',
          },
          {
            sNo: 9,
            floor: 'Ground Floor',
            description: 'Guest Lift Lobby',
            areaSqm: 44,
            areaSqft: 474,
            remarks: 'Central core guest vertical circulation',
          },
          {
            sNo: 10,
            floor: 'Ground Floor',
            description: 'Meeting Rooms',
            areaSqm: 80,
            areaSqft: 861,
            remarks: '2 executive conference boardrooms',
          },
        ],
        groundFloorSubtotal: { areaSqm: 2092, areaSqft: 22518 },
        secondFloor: [
          {
            sNo: 1,
            floor: '2nd Floor',
            description: 'Gym and Changing Rooms',
            areaSqm: 155,
            areaSqft: 1668,
            remarks: 'State-of-the-art fitness center with lockers',
          },
          {
            sNo: 2,
            floor: '2nd Floor',
            description: 'Pool Deck',
            areaSqm: 150,
            areaSqft: 1615,
            remarks: 'Sun lounges, shaded cabanas & service bar',
          },
          {
            sNo: 3,
            floor: '2nd Floor',
            description: 'Swimming Pool',
            areaSqm: 160,
            areaSqft: 1722,
            remarks: 'Temperature controlled overflow swimming pool',
          },
        ],
        secondFloorSubtotal: { areaSqm: 465, areaSqft: 5005 },
        grandSubtotal: { areaSqm: 2557, areaSqft: 27523 },
      },
      floorWiseBua: {
        items: [
          {
            sNo: 1,
            floor: 'Basement Floor',
            areaSqm: 1337,
            areaSqft: 14391,
            remarks: 'Parking (75 ECS), STP, WTP, DG yard & plant room',
          },
          {
            sNo: 2,
            floor: 'Ground floor',
            areaSqm: 3145,
            areaSqft: 33853,
            remarks: 'Main Lobby, Banquet, ADD, Lounge Bar, Commercial Kitchen',
          },
          {
            sNo: 3,
            floor: 'First Floor',
            areaSqm: 1008,
            areaSqft: 10850,
            remarks: 'BOH, Administration Offices & Staff Facilities',
          },
          {
            sNo: 4,
            floor: 'Service floor',
            areaSqm: 1333,
            areaSqft: 14348,
            remarks: 'MEP plant rooms, AHU units & transfer slab',
          },
          { sNo: 5, floor: '2nd floor', areaSqm: 1860, areaSqft: 20021, remarks: '41 Guest keys + Gym & Pool Deck' },
          { sNo: 6, floor: '3rd floor', areaSqm: 1860, areaSqft: 20021, remarks: '37 Guest keys' },
          { sNo: 7, floor: '4th floor', areaSqm: 1860, areaSqft: 20021, remarks: '37 Guest keys' },
          { sNo: 8, floor: '5th Floor', areaSqm: 1783, areaSqft: 19192, remarks: '37 Guest keys' },
          {
            sNo: 9,
            floor: '6th Floor',
            areaSqm: 1270,
            areaSqft: 13670,
            remarks: '4 Presidential Suites (16 bays footprint)',
          },
          {
            sNo: 10,
            floor: 'Terrace / Services',
            areaSqm: 68,
            areaSqft: 732,
            remarks: 'Lift machine room & overhead water storage',
          },
        ],
        subtotal: { areaSqm: 14970, areaSqft: 161137 },
      },
      roomConfiguration: {
        items: [
          { sNo: 1, floor: '2nd Guest Floor', keys: 41, bays: 41, remarks: '41 Standard Deluxe Rooms (41 bays)' },
          { sNo: 2, floor: '3rd Guest Floor', keys: 37, bays: 37, remarks: '37 Standard Deluxe Rooms (37 bays)' },
          { sNo: 3, floor: '4th Guest Floor', keys: 37, bays: 37, remarks: '37 Standard Deluxe Rooms (37 bays)' },
          { sNo: 4, floor: '5th Guest Floor', keys: 37, bays: 37, remarks: '37 Standard Deluxe Rooms (37 bays)' },
          {
            sNo: 5,
            floor: '6th Guest Floor',
            keys: 4,
            bays: 16,
            remarks: '4 Presidential Suites (4 bays per suite = 16 bays)',
          },
        ],
        totalKeys: 156,
        totalBays: 168,
      },
    },
    areaSheet: {
      slNo: 1,
      section: 'HOTELS',
      status: 'In Design',
      areaSqft: 161137,
      areaSqm: 14970,
    },
  };

  const projectRecord = {
    id: projectId,
    name: 'Vizag Hotel & Suites',
    location: 'Vizag',
    category: 'Hotel',
    code: 'VIZ-HTL-26',
    health: 'On track',
    status: 'In Design',
    progress: 22,
    target_date: '2027-03-31',
    target_label: '31 Mar 2027',
    aop: 1850000000,
    awarded: 420000000,
    spent: 18500000,
    projected_cost: 1850000000,
    area: '14,970 SQ.M. / 161,137 SQ.FT.',
    pax_keys: '156 Keys / 168 Bays',
    next_milestone: 'Detailed Design Development & BOQ',
    next_milestone_date: '2026-11-30',
    lead_id: 'user-chinmay-saxena',
    start_date: '2025-01-15',
    last_updated: new Date().toISOString(),
    specification_json: JSON.stringify(specification),
    template_id: 'hotel',
  };

  const phases = [
    {
      id: `${projectId}-phase-1`,
      project_id: projectId,
      name: 'Brief & Space Program',
      status: 'complete',
      progress: 100,
      owner: 'PMO',
      order_index: 0,
      planned_start: '2025-01-15',
      planned_finish: '2025-04-30',
      actual_finish: '2025-04-25',
      work_completed: 'Architectural space program approved (8,160 sqm site, 14,970 sqm BUA, 156 keys/168 bays).',
      next_action: 'Handover to concept design architecture.',
      decision_required: 'Approved by leadership.',
    },
    {
      id: `${projectId}-phase-2`,
      project_id: projectId,
      name: 'Concept & Schematic Design',
      status: 'active',
      progress: 55,
      owner: 'Design',
      order_index: 1,
      planned_start: '2025-05-01',
      planned_finish: '2025-11-30',
      work_completed: 'FOH public areas, Banquet 350 pax layout, and guest floor plans drafted.',
      next_action: 'Complete MEP, structural coordination, and 3D interior renders.',
      decision_required: 'Facade material palette sign-off.',
    },
    {
      id: `${projectId}-phase-3`,
      project_id: projectId,
      name: 'Statutory Approvals & Sourcing',
      status: 'upcoming',
      progress: 10,
      owner: 'Sourcing',
      order_index: 2,
      planned_start: '2025-12-01',
      planned_finish: '2026-04-30',
      work_completed: 'Preliminary RFP for MEP & Civil packages drafted.',
      next_action: 'Submit building sanction drawings and fire NOC clearance.',
      decision_required: 'General Contractor pre-qualification criteria.',
    },
    {
      id: `${projectId}-phase-4`,
      project_id: projectId,
      name: 'Civil & Fit-Out Execution',
      status: 'upcoming',
      progress: 0,
      owner: 'Projects',
      order_index: 3,
      planned_start: '2026-05-01',
      planned_finish: '2026-12-31',
      work_completed: 'Site boundary and soil testing completed.',
      next_action: 'Mobilize site team post contractor award.',
      decision_required: 'Excavation contractor selection.',
    },
    {
      id: `${projectId}-phase-5`,
      project_id: projectId,
      name: 'Commissioning & Handover',
      status: 'upcoming',
      progress: 0,
      owner: 'Operations',
      order_index: 4,
      planned_start: '2027-01-01',
      planned_finish: '2027-03-31',
      work_completed: 'Pre-opening checklist prepared.',
      next_action: 'Trial operations and hospitality snag clearance.',
      decision_required: 'Commercial operations date sign-off.',
    },
  ];

  const milestones = [
    {
      id: `${projectId}-ms-1`,
      project_id: projectId,
      title: 'Architectural Area Program Approval',
      date: '2025-04-15',
      status: 'complete',
      stage: 'Brief & Space Program',
      owner: 'Chinmay Saxena',
      approval_required: 1,
      approval_status: 'Approved',
      completed_date: '2025-04-12',
      order_index: 0,
    },
    {
      id: `${projectId}-ms-2`,
      project_id: projectId,
      title: 'Concept Design & 3D Render Presentation',
      date: '2025-08-30',
      status: 'complete',
      stage: 'Concept & Schematic Design',
      owner: 'Design Lead',
      approval_required: 1,
      approval_status: 'Approved',
      completed_date: '2025-08-28',
      order_index: 1,
    },
    {
      id: `${projectId}-ms-3`,
      project_id: projectId,
      title: 'Detailed Design Development & BOQ',
      date: '2026-11-30',
      status: 'upcoming',
      stage: 'Concept & Schematic Design',
      owner: 'Design Lead',
      approval_required: 1,
      approval_status: 'In review',
      order_index: 2,
    },
    {
      id: `${projectId}-ms-4`,
      project_id: projectId,
      title: 'Civil & MEP Package Tender Award',
      date: '2026-04-15',
      status: 'upcoming',
      stage: 'Statutory Approvals & Sourcing',
      owner: 'Sourcing Head',
      approval_required: 1,
      approval_status: 'Not required',
      order_index: 3,
    },
  ];

  const issues = [
    {
      id: `${projectId}-issue-1`,
      project_id: projectId,
      title: 'Airport Authority Height NOC Pending',
      detail: 'Clearance required from airport authority for crane operation during 6-floor structural construction.',
      severity: 'Medium',
      owner: 'Compliance Officer',
      category: 'Permits & Approvals',
      status: 'Open',
      stage: 'Design',
      impact_cost: null,
      impact_schedule: 'May impact crane mobilization scheduled for phase 4.',
      impact_scope: null,
      action: 'Follow up with regional aviation office for expedited NOC.',
      resolution: null,
      due_date: '2025-12-15',
      date_raised: '2025-09-01',
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
if (process.argv[1]?.includes('seed-vizag-database')) {
  seedVizagHotelToDatabase();
}

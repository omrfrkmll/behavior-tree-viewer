import { NodeCategory, NodeModel } from '../types';

/**
 * Complete BehaviorTree.CPP v4 Built-in and Standard Node Specifications
 */
export const DEFAULT_NODES: NodeModel[] = [
  // ==========================================
  // 1. CONTROL NODES (BT.CPP v4 Core Flow)
  // ==========================================
  {
    name: 'Sequence',
    category: NodeCategory.Control,
    description: 'Ticks children sequentially from left to right. Fails if any child fails, returns Running if a child is running, succeeds when all children succeed.',
    ports: []
  },
  {
    name: 'ReactiveSequence',
    category: NodeCategory.Control,
    description: 'Continuously re-ticks previous children. If any previous condition turns Failure, halts the running child and returns Failure.',
    ports: []
  },
  {
    name: 'Fallback',
    category: NodeCategory.Control,
    description: 'Selector: Ticks children sequentially until one returns SUCCESS or RUNNING. Returns FAILURE only if all children fail.',
    ports: []
  },
  {
    name: 'ReactiveFallback',
    category: NodeCategory.Control,
    description: 'Continuously re-ticks previous children to check if a higher-priority child can succeed and abort the currently running child.',
    ports: []
  },
  {
    name: 'Parallel',
    category: NodeCategory.Control,
    description: 'Ticks all children concurrently. Returns Success/Failure based on specified success/failure thresholds.',
    ports: [
      { name: 'success_count', direction: 'input', type: 'int', defaultValue: '1', description: 'Threshold of successful children required' },
      { name: 'failure_count', direction: 'input', type: 'int', defaultValue: '1', description: 'Threshold of failed children required' }
    ]
  },
  {
    name: 'ParallelAll',
    category: NodeCategory.Control,
    description: 'Ticks all children concurrently. Returns Success only when ALL children succeed, fails if failures exceed threshold.',
    ports: [
      { name: 'max_failures', direction: 'input', type: 'int', defaultValue: '1', description: 'Maximum allowed child failures before failing' }
    ]
  },
  {
    name: 'IfThenElse',
    category: NodeCategory.Control,
    description: 'Node with 2 or 3 children: 1st is Condition. If Success, ticks 2nd child (Then). If Failure, ticks optional 3rd child (Else).',
    ports: []
  },
  {
    name: 'WhileDoElse',
    category: NodeCategory.Control,
    description: 'Ticks 1st child (Condition) continuously while 2nd (Do) is running. If condition fails, ticks optional 3rd child (Else).',
    ports: []
  },
  {
    name: 'Switch2',
    category: NodeCategory.Control,
    description: 'Executes branch matching variable value against case_1 or case_2.',
    ports: [
      { name: 'variable', direction: 'input', type: 'std::string', description: 'Blackboard variable to match' },
      { name: 'case_1', direction: 'input', type: 'std::string', description: 'Value for 1st child' },
      { name: 'case_2', direction: 'input', type: 'std::string', description: 'Value for 2nd child' }
    ]
  },
  {
    name: 'Switch3',
    category: NodeCategory.Control,
    description: 'Executes branch matching variable value against 3 cases.',
    ports: [
      { name: 'variable', direction: 'input', type: 'std::string', description: 'Blackboard variable to match' },
      { name: 'case_1', direction: 'input', type: 'std::string', description: 'Value for 1st child' },
      { name: 'case_2', direction: 'input', type: 'std::string', description: 'Value for 2nd child' },
      { name: 'case_3', direction: 'input', type: 'std::string', description: 'Value for 3rd child' }
    ]
  },
  {
    name: 'RecoveryNode',
    category: NodeCategory.Control,
    description: 'Executes primary task (1st child). If it fails, executes recovery action (2nd child) up to N retries.',
    ports: [
      { name: 'number_of_retries', direction: 'input', type: 'int', defaultValue: '3', description: 'Number of recovery attempts allowed' }
    ]
  },
  {
    name: 'PipelineSequence',
    category: NodeCategory.Control,
    description: 'Ticks children sequentially like a pipeline; re-ticks prior children even while later ones are running.',
    ports: []
  },
  {
    name: 'RoundRobin',
    category: NodeCategory.Control,
    description: 'Ticks one child per tick in a cyclical round-robin order.',
    ports: []
  },

  // ==========================================
  // 2. DECORATOR NODES (BT.CPP v4 Built-in)
  // ==========================================
  {
    name: 'Inverter',
    category: NodeCategory.Decorator,
    description: 'Inverts child result: SUCCESS becomes FAILURE, and FAILURE becomes SUCCESS. RUNNING is preserved.',
    ports: []
  },
  {
    name: 'ForceSuccess',
    category: NodeCategory.Decorator,
    description: 'Always returns SUCCESS whenever child completes, regardless of whether child succeeded or failed.',
    ports: []
  },
  {
    name: 'ForceFailure',
    category: NodeCategory.Decorator,
    description: 'Always returns FAILURE whenever child completes, regardless of whether child succeeded or failed.',
    ports: []
  },
  {
    name: 'Repeat',
    category: NodeCategory.Decorator,
    description: 'Executes child repeatedly up to num_cycles. If child fails, returns FAILURE immediately.',
    ports: [
      { name: 'num_cycles', direction: 'input', type: 'int', defaultValue: '3', description: 'Number of repeat cycles (-1 for infinite)' }
    ]
  },
  {
    name: 'RetryUntilSuccessful',
    category: NodeCategory.Decorator,
    description: 'Re-ticks child upon FAILURE up to num_attempts times until it returns SUCCESS.',
    ports: [
      { name: 'num_attempts', direction: 'input', type: 'int', defaultValue: '3', description: 'Max retry attempts (-1 for infinite)' }
    ]
  },
  {
    name: 'KeepRunningUntilFailure',
    category: NodeCategory.Decorator,
    description: 'Keeps ticking child as long as child returns SUCCESS or RUNNING. Returns FAILURE when child fails.',
    ports: []
  },
  {
    name: 'Delay',
    category: NodeCategory.Decorator,
    description: 'Delays the execution of child by specified milliseconds before ticking it.',
    ports: [
      { name: 'delay_msec', direction: 'input', type: 'unsigned', defaultValue: '1000', description: 'Delay in milliseconds' }
    ]
  },
  {
    name: 'Timeout',
    category: NodeCategory.Decorator,
    description: 'Limits child execution duration. If time exceeds threshold, aborts child and returns FAILURE.',
    ports: [
      { name: 'msec', direction: 'input', type: 'unsigned', defaultValue: '5000', description: 'Timeout limit in milliseconds' }
    ]
  },
  {
    name: 'RateController',
    category: NodeCategory.Decorator,
    description: 'Throttles child execution to a maximum rate in Hz.',
    ports: [
      { name: 'hz', direction: 'input', type: 'double', defaultValue: '10.0', description: 'Target frequency rate in Hz' }
    ]
  },
  {
    name: 'DistanceController',
    category: NodeCategory.Decorator,
    description: 'Ticks child only after robot travels specified distance threshold in meters.',
    ports: [
      { name: 'distance', direction: 'input', type: 'double', defaultValue: '1.0', description: 'Distance delta threshold in meters' }
    ]
  },

  // ==========================================
  // 3. ACTION NODES (BT.CPP v4 Built-in & Common)
  // ==========================================
  {
    name: 'AlwaysSuccess',
    category: NodeCategory.Action,
    description: 'Built-in node that immediately returns SUCCESS upon tick.',
    ports: []
  },
  {
    name: 'AlwaysFailure',
    category: NodeCategory.Action,
    description: 'Built-in node that immediately returns FAILURE upon tick.',
    ports: []
  },
  {
    name: 'SetBlackboard',
    category: NodeCategory.Action,
    description: 'Writes a static or expression value into blackboard key.',
    ports: [
      { name: 'output_key', direction: 'output', type: 'std::string', description: 'Destination blackboard key name' },
      { name: 'value', direction: 'input', type: 'std::string', description: 'Value to assign' }
    ]
  },
  {
    name: 'Sleep',
    category: NodeCategory.Action,
    description: 'Asynchronous sleep node that stays RUNNING for specified milliseconds.',
    ports: [
      { name: 'msec', direction: 'input', type: 'unsigned', defaultValue: '1000', description: 'Sleep duration in milliseconds' }
    ]
  },
  {
    name: 'Script',
    category: NodeCategory.Action,
    description: 'Executes small BT.CPP scripting expression to modify blackboard entries.',
    ports: [
      { name: 'code', direction: 'input', type: 'std::string', description: 'Script expression, e.g. "count=count+1"' }
    ]
  },
  {
    name: 'PassThrough',
    category: NodeCategory.Action,
    description: 'Copies input value directly to output port with type conversion.',
    ports: [
      { name: 'value', direction: 'input', type: 'std::string', description: 'Input value' },
      { name: 'output', direction: 'output', type: 'std::string', description: 'Output value' }
    ]
  },

  // Common Robotic & Demo Actions (Nav2 / BT.CPP Samples)
  {
    name: 'ComputePathToPose',
    category: NodeCategory.Action,
    description: 'Computes a collision-free path to destination goal pose.',
    ports: [
      { name: 'goal', direction: 'input', type: 'geometry_msgs::msg::PoseStamped', description: 'Target destination pose' },
      { name: 'planner_id', direction: 'input', type: 'std::string', defaultValue: 'GridBased', description: 'Planner plugin identifier' },
      { name: 'path', direction: 'output', type: 'nav2_msgs::msg::Path', description: 'Output generated path' }
    ]
  },
  {
    name: 'FollowPath',
    category: NodeCategory.Action,
    description: 'Tracks the given trajectory path with robot controller.',
    ports: [
      { name: 'path', direction: 'input', type: 'nav2_msgs::msg::Path', description: 'Path to follow' },
      { name: 'controller_id', direction: 'input', type: 'std::string', defaultValue: 'FollowPath', description: 'Controller plugin identifier' }
    ]
  },
  {
    name: 'SmoothPath',
    category: NodeCategory.Action,
    description: 'Applies trajectory smoothing to raw planned path.',
    ports: [
      { name: 'unsmoothed_path', direction: 'input', type: 'nav2_msgs::msg::Path', description: 'Original unsmoothed path' },
      { name: 'smoothed_path', direction: 'output', type: 'nav2_msgs::msg::Path', description: 'Resulting smooth path' }
    ]
  },
  {
    name: 'ClearEntireCostmap',
    category: NodeCategory.Action,
    description: 'Clears costmap obstacles and resets layer grids via service.',
    ports: [
      { name: 'service_name', direction: 'input', type: 'std::string', defaultValue: 'local_costmap/clear_entirely_local_costmap', description: 'ROS 2 costmap service' }
    ]
  },
  {
    name: 'Wait',
    category: NodeCategory.Action,
    description: 'Pauses robot execution for specified duration in seconds.',
    ports: [
      { name: 'wait_duration', direction: 'input', type: 'double', defaultValue: '2.0', description: 'Wait duration in seconds' }
    ]
  },
  {
    name: 'WaitAction',
    category: NodeCategory.Action,
    description: 'Sample wait action with duration parameter.',
    ports: [
      { name: 'wait_action_duration', direction: 'input', type: 'double', defaultValue: '2.0', description: 'Wait duration in seconds' }
    ]
  },
  {
    name: 'Spin',
    category: NodeCategory.Action,
    description: 'Executes recovery spin in place by angle in radians.',
    ports: [
      { name: 'spin_dist', direction: 'input', type: 'double', defaultValue: '1.57', description: 'Rotation angle in radians' }
    ]
  },
  {
    name: 'NavigateToPose',
    category: NodeCategory.Action,
    description: 'High-level navigation action to drive to target pose.',
    ports: [
      { name: 'goal', direction: 'input', type: 'geometry_msgs::msg::PoseStamped', description: 'Goal target pose' }
    ]
  },
  {
    name: 'NavigateThroughPoses',
    category: NodeCategory.Action,
    description: 'Navigates sequentially through an array of goal waypoints.',
    ports: [
      { name: 'poses', direction: 'input', type: 'geometry_msgs::msg::PoseArray', description: 'Array of waypoint poses' }
    ]
  },
  {
    name: 'GoToPose',
    category: NodeCategory.Action,
    description: 'Sample motion primitive action to reach coordinate target.',
    ports: [
      { name: 'target_pose', direction: 'input', type: 'geometry_msgs::msg::PoseStamped', description: 'Target destination pose' }
    ]
  },
  {
    name: 'DockRobot',
    category: NodeCategory.Action,
    description: 'Docks robot onto charging station dock.',
    ports: [
      { name: 'dock_id', direction: 'input', type: 'std::string', defaultValue: 'home_dock', description: 'Charging dock identifier' }
    ]
  },
  {
    name: 'LoadAndIterateLocations',
    category: NodeCategory.Action,
    description: 'Reads location list from file and iterates targets onto blackboard.',
    ports: [
      { name: 'locations_file', direction: 'input', type: 'std::string', description: 'Path to configuration file' },
      { name: 'target_pose', direction: 'output', type: 'geometry_msgs::msg::PoseStamped', description: 'Active destination waypoint' },
      { name: 'num_locations', direction: 'output', type: 'int', description: 'Total location count loaded' }
    ]
  },
  {
    name: 'WriteModbus',
    category: NodeCategory.Action,
    description: 'Writes boolean/register value to PLC Modbus address.',
    ports: [
      { name: 'address', direction: 'input', type: 'std::string', description: 'Modbus coil or register address' },
      { name: 'value', direction: 'input', type: 'std::string', description: 'Value to write (true/false or integer)' }
    ]
  },
  {
    name: 'SetModbusRegister',
    category: NodeCategory.Action,
    description: 'Sets specific Modbus PLC integer register.',
    ports: [
      { name: 'address', direction: 'input', type: 'std::string', description: 'Register address' },
      { name: 'value', direction: 'input', type: 'int', description: 'Integer value' }
    ]
  },

  // ==========================================
  // 4. CONDITION NODES (BT.CPP v4 Built-in)
  // ==========================================
  {
    name: 'ScriptCondition',
    category: NodeCategory.Condition,
    description: 'Evaluates logical script expression on blackboard. Returns SUCCESS if true, FAILURE if false.',
    ports: [
      { name: 'code', direction: 'input', type: 'std::string', description: 'Boolean expression, e.g. "battery > 20"' }
    ]
  },
  {
    name: 'CheckModbus',
    category: NodeCategory.Condition,
    description: 'Checks value of PLC Modbus address against expected value.',
    ports: [
      { name: 'address', direction: 'input', type: 'std::string', description: 'Modbus address to inspect' },
      { name: 'expected_value', direction: 'input', type: 'std::string', description: 'Expected value for comparison' }
    ]
  },
  {
    name: 'GoalReached',
    category: NodeCategory.Condition,
    description: 'Verifies whether robot current position matches goal within tolerance.',
    ports: [
      { name: 'goal', direction: 'input', type: 'geometry_msgs::msg::PoseStamped', description: 'Goal pose to verify' }
    ]
  },
  {
    name: 'IsStuck',
    category: NodeCategory.Condition,
    description: 'Checks if robot kinematics or lidar detect stuck state.',
    ports: []
  },
  {
    name: 'TransformAvailable',
    category: NodeCategory.Condition,
    description: 'Verifies whether TF coordinate frame transformation is available.',
    ports: [
      { name: 'child', direction: 'input', type: 'std::string', defaultValue: 'base_link', description: 'Child TF frame' },
      { name: 'parent', direction: 'input', type: 'std::string', defaultValue: 'map', description: 'Parent TF frame' }
    ]
  },

  // ==========================================
  // 5. SUBTREE
  // ==========================================
  {
    name: 'SubTree',
    category: NodeCategory.SubTree,
    description: 'Invokes a reusable sub-behavior tree defined in the XML root.',
    ports: []
  }
];

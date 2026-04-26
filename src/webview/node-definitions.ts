export interface NodeType {
    name: string;
    type: 'Control' | 'Decorator' | 'Action' | 'Condition' | 'SubTree';
    description?: string;
    // Default attributes
    attributes?: Record<string, string>;
}

export const NODE_DEFINITIONS: NodeType[] = [
    // Control Nodes
    { name: 'Sequence', type: 'Control', description: 'Executes children sequentially. Fails if any child fails.' },
    { name: 'Fallback', type: 'Control', description: 'Executes children sequentially. Succeeds if any child succeeds.' },
    { name: 'ReactiveSequence', type: 'Control' },
    { name: 'ReactiveFallback', type: 'Control' },
    { name: 'Parallel', type: 'Control', attributes: { success_threshold: '1', failure_threshold: '1' } },

    // Nav2 Specific Controls
    { name: 'PipelineSequence', type: 'Control', description: 'Nav2: Executes children in a pipeline fashion.' },
    { name: 'RecoveryNode', type: 'Control', description: 'Nav2: Tries primary action, runs recovery on failure, then retries.' },
    { name: 'RoundRobin', type: 'Control' },

    // Decorators
    { name: 'Inverter', type: 'Decorator' },
    { name: 'ForceSuccess', type: 'Decorator' },
    { name: 'ForceFailure', type: 'Decorator' },
    { name: 'Repeat', type: 'Decorator', attributes: { num_cycles: '1' } },
    { name: 'RetryUntilSuccessful', type: 'Decorator', attributes: { num_attempts: '3' } },

    // Nav2 Decorators
    { name: 'RateController', type: 'Decorator', attributes: { hz: '1.0' } },
    { name: 'GoalUpdater', type: 'Decorator' },
    { name: 'SingleTrigger', type: 'Decorator' },
    { name: 'SpeedController', type: 'Decorator', attributes: { min_rate: '0.1', max_rate: '1.0', filter_duration: '0.3' } },

    // Nav2 Actions
    { name: 'ComputePathToPose', type: 'Action', attributes: { goal: '{goal}', path: '{path}', planner_id: 'GridBased' } },
    { name: 'FollowPath', type: 'Action', attributes: { path: '{path}', controller_id: 'FollowPath' } },
    { name: 'Spin', type: 'Action', attributes: { spin_dist: '1.57' } },
    { name: 'Wait', type: 'Action', attributes: { duration: '1.0' } },
    { name: 'Backup', type: 'Action', attributes: { backup_dist: '0.15', backup_speed: '0.025' } },
    { name: 'ClearEntireCostmap', type: 'Action', attributes: { service_name: 'local_costmap/clear_entirely_local_costmap' } },
    { name: 'NavigateToPose', type: 'Action', attributes: { goal: '{goal}' } },
    { name: 'TruncatePath', type: 'Action' },

    // Conditions
    { name: 'IsStuck', type: 'Condition' },
    { name: 'GoalReached', type: 'Condition' },
    { name: 'TransformAvailable', type: 'Condition' },
    { name: 'InitialPoseReceived', type: 'Condition' },
    { name: 'DistanceTraveled', type: 'Condition', attributes: { distance: '1.0', global_frame: 'map', robot_base_frame: 'base_link' } }
];

export function getGroupedNodes() {
    const groups: Record<string, NodeType[]> = {};
    NODE_DEFINITIONS.forEach(node => {
        if (!groups[node.type]) {
            groups[node.type] = [];
        }
        groups[node.type].push(node);
    });
    return groups;
}

"use client";

import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Area,
    AreaChart,
    BarChart,
    Bar,
    Cell
} from 'recharts';

interface ChartProps {
    data: any[];
    type: 'weight' | 'calories';
    goal?: number;
}

export function ProgressChart({ data, type, goal }: ChartProps) {
    if (type === 'weight') {
        return (
            <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data}>
                        <defs>
                            <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#d946ef" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                        <XAxis
                            dataKey="date"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#71717a', fontSize: 10 }}
                            dy={10}
                        />
                        <YAxis
                            hide
                            domain={['dataMin - 2', 'dataMax + 2']}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: '#09090b',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '12px',
                                fontSize: '12px'
                            }}
                            itemStyle={{ color: '#d946ef' }}
                        />
                        <Area
                            type="monotone"
                            dataKey="weight"
                            stroke="#d946ef"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#weightGradient)"
                            animationDuration={1500}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        );
    }

    return (
        <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#71717a', fontSize: 10 }}
                        dy={10}
                    />
                    <YAxis hide domain={[0, 'dataMax + 500']} />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: '#09090b',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '12px',
                            fontSize: '12px'
                        }}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {data.map((entry, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={entry.value >= (goal || 0) ? '#d946ef' : '#3b82f6'}
                                fillOpacity={0.8}
                            />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

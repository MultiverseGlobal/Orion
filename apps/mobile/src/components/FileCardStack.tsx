// @ts-nocheck
import { SpringButton } from '../components/SpringButton';
import { Colors } from '../theme/colors';
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import Svg, { Rect, Line, G } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { OrionFileCard } from '../store/useOrionStore';

const { width } = Dimensions.get('window');

interface FileCardStackProps {
  files: OrionFileCard[];
  isEditMode: boolean;
  onSelectFile?: (file: OrionFileCard) => void;
}

// Each card's x-offset and width ratio in the "floating stack" view
// These match the zig-zag staggered pattern from the Dribbble reference (frame 198-220)
const CARD_PRESETS = [
  { offsetX: 20,   widthRatio: 0.72, align: 'right' as const },   // June_Info — right-leaning
  { offsetX: 30,   widthRatio: 0.80, align: 'center' as const },  // Apple_keynote — center-right
  { offsetX: -30,  widthRatio: 0.70, align: 'left' as const },    // Apple_Stats — left-leaning
  { offsetX: 40,   widthRatio: 0.72, align: 'right' as const },   // Symbols — right-leaning
  { offsetX: -40,  widthRatio: 0.65, align: 'left' as const },    // WM_Agenda — far left
  { offsetX: 20,   widthRatio: 0.78, align: 'center' as const },  // Brief_May — center-right
  { offsetX: -20,  widthRatio: 0.68, align: 'left' as const },    // Brief_June — left
];

// Miniature document thumbnail SVG — matching the ruled-line icons from the reference
const DocThumbnail: React.FC<{ type: OrionFileCard['iconType'] }> = ({ type }) => {
  if (type === 'cube') {
    // 3D wireframe cube
    return (
      <Svg width={32} height={32} viewBox="0 0 32 32">
        <G stroke={Colors.textMuted} strokeWidth={1} fill="none">
          {/* Front face */}
          <Rect x={6} y={10} width={14} height={14} rx={0.5} />
          {/* Top face */}
          <Line x1={6} y1={10} x2={12} y2={6} />
          <Line x1={20} y1={10} x2={26} y2={6} />
          <Line x1={12} y1={6} x2={26} y2={6} />
          {/* Right face */}
          <Line x1={20} y1={24} x2={26} y2={20} />
          <Line x1={26} y1={6} x2={26} y2={20} />
        </G>
      </Svg>
    );
  }

  if (type === 'chart') {
    // Presentation/chart document
    return (
      <Svg width={32} height={32} viewBox="0 0 32 32">
        <Rect x={4} y={4} width={24} height={24} rx={2} stroke="#C4C8D0" strokeWidth={1} fill={Colors.porcelainSubtle} />
        {/* Horizontal ruled lines */}
        <Line x1={8} y1={10} x2={20} y2={10} stroke={Colors.textMuted} strokeWidth={0.8} />
        <Line x1={8} y1={14} x2={24} y2={14} stroke="#D1D5DB" strokeWidth={0.6} />
        <Line x1={8} y1={18} x2={18} y2={18} stroke="#D1D5DB" strokeWidth={0.6} />
        <Line x1={8} y1={22} x2={22} y2={22} stroke="#D1D5DB" strokeWidth={0.6} />
      </Svg>
    );
  }

  // Default: document with ruled lines (matching the reference's miniature PDF thumbs)
  return (
    <Svg width={32} height={32} viewBox="0 0 32 32">
      <Rect x={4} y={3} width={24} height={26} rx={2} stroke="#C4C8D0" strokeWidth={1} fill={Colors.porcelainSubtle} />
      {/* Header area */}
      <Rect x={4} y={3} width={24} height={8} rx={2} fill={Colors.porcelainSubtle} stroke="#C4C8D0" strokeWidth={0.5} />
      {/* Ruled text lines */}
      <Line x1={8} y1={15} x2={22} y2={15} stroke="#D1D5DB" strokeWidth={0.7} />
      <Line x1={8} y1={18.5} x2={24} y2={18.5} stroke="#D1D5DB" strokeWidth={0.7} />
      <Line x1={8} y1={22} x2={20} y2={22} stroke="#D1D5DB" strokeWidth={0.7} />
      <Line x1={8} y1={25.5} x2={18} y2={25.5} stroke={Colors.borderMedium} strokeWidth={0.5} />
    </Svg>
  );
};

const FileCardItem: React.FC<{
  file: OrionFileCard;
  index: number;
  isEditMode: boolean;
  onSelect?: (file: OrionFileCard) => void;
}> = ({ file, index, isEditMode, onSelect }) => {
  const entranceY = useSharedValue(200);
  const entranceOpacity = useSharedValue(0);
  const offsetProgress = useSharedValue(isEditMode ? 0 : 1);

  const preset = CARD_PRESETS[index % CARD_PRESETS.length];

  useEffect(() => {
    // Staggered entrance — cards fly in one by one from bottom
    entranceY.value = withDelay(
      index * 100,
      withTiming(0, { duration: 700, easing: Easing.bezier(0.16, 1, 0.3, 1) })
    );
    entranceOpacity.value = withDelay(
      index * 100,
      withTiming(1, { duration: 500 })
    );
  }, [index, entranceY, entranceOpacity]);

  useEffect(() => {
    // Animate between staggered offset (stack) and aligned (list edit mode)
    offsetProgress.value = withTiming(isEditMode ? 0 : 1, {
      duration: 450,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    });
  }, [isEditMode, offsetProgress]);

  const animatedStyle = useAnimatedStyle(() => {
    const currentOffsetX = preset.offsetX * offsetProgress.value;
    const stackWidth = (width - 48) * preset.widthRatio;
    const editWidth = width - 48;
    const currentWidth = stackWidth + (editWidth - stackWidth) * (1 - offsetProgress.value);

    return {
      opacity: entranceOpacity.value,
      width: currentWidth,
      alignSelf: offsetProgress.value > 0.5 ? (preset.align === 'left' ? 'flex-start' : preset.align === 'right' ? 'flex-end' : 'center') as any : 'center',
      transform: [
        { translateY: entranceY.value },
        { translateX: currentOffsetX },
      ],
    };
  });

  return (
    <SpringButton activeOpacity={0.85} onPress={() => onSelect?.(file)}>
      <Animated.View style={[styles.card, animatedStyle]}>
        {/* Document thumbnail */}
        <View style={styles.thumbBox}>
          <DocThumbnail type={file.iconType} />
        </View>

        {/* Info column */}
        <View style={styles.infoCol}>
          <View style={styles.topRow}>
            <Text style={styles.fileName} numberOfLines={1}>
              {file.name}
            </Text>
            <Text style={styles.fileSize}>{file.size}</Text>
          </View>
          <Text style={styles.timestamp}>{file.timestamp}</Text>
          <Text style={styles.formatText} numberOfLines={1}>
            {file.format}
          </Text>
        </View>
      </Animated.View>
    </SpringButton>
  );
};

export const FileCardStack: React.FC<FileCardStackProps> = ({ files, isEditMode, onSelectFile }) => {
  return (
    <ScrollView
      style={styles.scrollContainer}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {files.map((file, idx) => (
        <FileCardItem
          key={file.id}
          file={file}
          index={idx}
          isEditMode={isEditMode}
          onSelect={onSelectFile}
        />
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
  },
  contentContainer: {
    paddingTop: 12,
    paddingBottom: 120,
    paddingHorizontal: 24,
    gap: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.porcelainCard,
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 18,
    elevation: 3,
    borderWidth: 0.5,
    borderColor: 'rgba(0, 0, 0, 0.04)',
  },
  thumbBox: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoCol: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.1,
  },
  fileSize: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: 0.2,
  },
  timestamp: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginBottom: 1,
  },
  formatText: {
    fontSize: 10,
    color: Colors.textMuted,
    letterSpacing: 0.1,
  },
});

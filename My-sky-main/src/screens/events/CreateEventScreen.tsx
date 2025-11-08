import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, Platform, Switch } from 'react-native';
import { useNavigation, useRoute, RouteProp, CompositeNavigationProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import DateTimePicker from '@react-native-community/datetimepicker';
import firestore from '@react-native-firebase/firestore';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../../contexts/AuthContext';
import { DiscoverStackParamList, ProfileStackParamList } from '../../navigation/types';
import { theme } from '../../styles/theme';
import { getCurrentLocation } from '../../utils/locationUtils';
import PrefectureSelector from '../../components/PrefectureSelector';
import { getLocationString } from '../../utils/prefectureData';

type CreateEventRouteProp = RouteProp<DiscoverStackParamList | ProfileStackParamList, 'CreateEvent'>;
type CreateEventNavigationProp = CompositeNavigationProp<
  StackNavigationProp<DiscoverStackParamList, 'CreateEvent'>,
  StackNavigationProp<ProfileStackParamList>
>;

// ジャンルのカテゴリーリスト
const CATEGORIES = [
  { id: 'art', name: 'アート、クリエイティブ系' },
  { id: 'music', name: '音楽' },
  { id: 'sports', name: 'スポーツ、アウトドア' },
  { id: 'game', name: 'ゲーム、エンタメ系' },
  { id: 'food', name: '料理、グルメ' },
  { id: 'science', name: '科学、サイエンス' },
  { id: 'fashion', name: 'ファッション、美容' },
  { id: 'vehicle', name: '乗り物、コレクション' },
  { id: 'literature', name: '文学、言語' },
  { id: 'animal', name: 'ペット、動物' },
  { id: 'social', name: '社会、文化' },
  { id: 'business', name: '起業、イベント' },
];

const CreateEventScreen: React.FC = () => {
  const { user } = useAuth();
  const navigation = useNavigation<CreateEventNavigationProp>();
  const route = useRoute<CreateEventRouteProp>();
  const { circleId } = route.params;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [locationName, setLocationName] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [time, setTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [maxParticipants, setMaxParticipants] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [useCurrentLocation, setUseCurrentLocation] = useState(false);
  const [location, setLocation] = useState<{latitude: number; longitude: number} | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [prefectureId, setPrefectureId] = useState<string>('');
  const [cityId, setCityId] = useState<string>('');
  const [showPrefectureSelector, setShowPrefectureSelector] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});

  // 位置情報が有効な場合、現在地を取得
  useEffect(() => {
    if (useCurrentLocation) {
      fetchCurrentLocation();
    } else {
      setLocation(null);
    }
  }, [useCurrentLocation]);

  const fetchCurrentLocation = async () => {
    try {
      const coords = await getCurrentLocation();
      setLocation({
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
    } catch (error) {
      console.error('Error getting current location:', error);
      Alert.alert('エラー', '現在地を取得できませんでした');
      setUseCurrentLocation(false);
    }
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  const onTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (selectedTime) {
      setTime(selectedTime);
    }
  };

  const showDatepicker = () => {
    setShowDatePicker(true);
  };

  const showTimepicker = () => {
    setShowTimePicker(true);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const formatTime = (time: Date) => {
    return time.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleCategoryToggle = (categoryId: string) => {
    setSelectedCategories(prev => {
      if (prev.includes(categoryId)) {
        return prev.filter(id => id !== categoryId);
      } else {
        if (prev.length < 3) {
          return [...prev, categoryId];
        }
        Alert.alert('選択上限', 'カテゴリーは最大3つまで選択できます');
        return prev;
      }
    });
  };

  const handlePrefectureSelect = (selectedPrefectureId: string, selectedCityId?: string) => {
    setPrefectureId(selectedPrefectureId);
    if (selectedCityId) {
      setCityId(selectedCityId);
    } else {
      setCityId('');
    }
  };

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {};

    if (!title.trim()) {
      newErrors.title = 'イベントタイトルを入力してください';
    }

    if (!description.trim()) {
      newErrors.description = 'イベント詳細を入力してください';
    }

    if (!prefectureId) {
      newErrors.prefecture = '都道府県を選択してください';
    }
    
    if (!locationName.trim() && !prefectureId) {
      newErrors.location = '開催場所を入力するか、都道府県を選択してください';
    }

    if (selectedCategories.length === 0) {
      newErrors.categories = 'ジャンルを1つ以上選択してください';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const createEvent = async () => {
    if (!validateForm()) {
      return;
    }

    if (!user) {
      Alert.alert('エラー', 'ログインが必要です');
      return;
    }

    setIsLoading(true);

    try {
      // 開始日時の設定（日付と時間を組み合わせる）
      const startDateTime = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        time.getHours(),
        time.getMinutes(),
        0,
        0
      );

      // 日付のバリデーション
      if (isNaN(startDateTime.getTime())) {
        Alert.alert('エラー', '無効な日付または時間が指定されています');
        setIsLoading(false);
        return;
      }

      console.log('作成するイベントの日時:', startDateTime);

      // サークル情報を取得
      const circleDoc = await firestore().collection('circles').doc(circleId).get();
      if (!circleDoc.exists) {
        Alert.alert('エラー', 'サークル情報の取得に失敗しました');
        setIsLoading(false);
        return;
      }

      const circleData = circleDoc.data();
      if (!circleData) {
        Alert.alert('エラー', 'サークルデータの取得に失敗しました');
        setIsLoading(false);
        return;
      }

      // イベントデータの作成
      const eventData = {
        circleId,
        title,
        description,
        locationName,
        location: useCurrentLocation ? location : null,
        startDate: firestore.Timestamp.fromDate(startDateTime),
        maxParticipants: maxParticipants ? parseInt(maxParticipants, 10) : null,
        isPrivate: circleData.isPrivate,
        requiresApproval,
        attendees: [user.id], // 作成者を自動的に参加者として追加
        pendingAttendees: [],
        createdBy: user.id,
        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
        prefecture: prefectureId || null,
        city: cityId || null,
        categories: selectedCategories.length > 0 ? selectedCategories : null,
      };

      // Firestoreにイベントを追加
      const eventRef = await firestore().collection('events').add(eventData);
      
      console.log('イベント作成成功、ID:', eventRef.id);
      
      // イベントデータが正しく保存されたか確認
      try {
        const eventSnapshot = await firestore().collection('events').doc(eventRef.id).get();
        if (eventSnapshot.exists) {
          console.log('イベントデータが正常に保存されました:', eventSnapshot.data());
          
          // 成功メッセージを表示
          Alert.alert(
            '成功',
            'イベントが正常に作成されました',
            [
              { 
                text: 'OK', 
                onPress: () => navigation.navigate('EventDetails', { eventId: eventRef.id })
              }
            ]
          );
        } else {
          console.error('イベントデータが見つかりません:', eventRef.id);
          // エラーの場合はアラートを表示してサークル詳細に戻る
          Alert.alert('エラー', 'イベントデータの読み込みに失敗しました', [
            { 
              text: 'OK',
              onPress: () => navigation.goBack()
            }
          ]);
        }
      } catch (error) {
        console.error('イベントデータの読み込みエラー:', error);
        Alert.alert('エラー', 'イベントデータの読み込みに失敗しました', [
        {
          text: 'OK',
            onPress: () => navigation.goBack()
          }
      ]);
      }
    } catch (error) {
      console.error('イベント作成エラー:', error);
      Alert.alert('エラー', 'イベントの作成に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>新しいイベントを作成</Text>
      
      <View style={styles.inputContainer}>
        <Text style={styles.label}>イベント名</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="イベント名を入力"
        />
        {errors.title ? <Text style={styles.errorText}>{errors.title}</Text> : null}
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>説明</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="イベントの詳細を入力"
          multiline
          numberOfLines={4}
        />
        {errors.description ? <Text style={styles.errorText}>{errors.description}</Text> : null}
      </View>
      
      <View style={styles.inputContainer}>
        <Text style={styles.label}>ジャンル (最大3つ)</Text>
        <View style={styles.categoriesContainer}>
          {CATEGORIES.map(category => (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.categoryChip,
                selectedCategories.includes(category.id) && styles.selectedCategoryChip,
              ]}
              onPress={() => handleCategoryToggle(category.id)}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  selectedCategories.includes(category.id) && styles.selectedCategoryChipText,
                ]}
              >
                {category.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {errors.categories ? <Text style={styles.errorText}>{errors.categories}</Text> : null}
        {selectedCategories.length > 0 && (
          <Text style={styles.selectedCategoriesText}>
            選択中: {selectedCategories.map(id => CATEGORIES.find(c => c.id === id)?.name).join(', ')}
          </Text>
        )}
      </View>
      
      <View style={styles.inputContainer}>
        <Text style={styles.label}>開催地域</Text>
        <TouchableOpacity
          style={styles.prefectureSelector}
          onPress={() => setShowPrefectureSelector(true)}
        >
          <Text style={prefectureId ? styles.prefectureText : styles.placeholderText}>
            {prefectureId ? getLocationString(prefectureId, cityId) : '都道府県を選択'}
          </Text>
          <Icon name="chevron-down" size={20} color="#666" />
        </TouchableOpacity>
        {errors.prefecture ? <Text style={styles.errorText}>{errors.prefecture}</Text> : null}
      </View>
      
      <View style={styles.inputContainer}>
        <Text style={styles.label}>会場名</Text>
        <TextInput
          style={styles.input}
          value={locationName}
          onChangeText={setLocationName}
          placeholder="会場名を入力"
        />
        {errors.location ? <Text style={styles.errorText}>{errors.location}</Text> : null}
      </View>
      
      <View style={styles.switchContainer}>
        <Text style={styles.switchLabel}>現在地を使用</Text>
        <Switch
          value={useCurrentLocation}
          onValueChange={setUseCurrentLocation}
          trackColor={{ false: '#d9d9d9', true: theme.colors.primary }}
          thumbColor={useCurrentLocation ? '#ffffff' : '#f4f3f4'}
        />
      </View>
      
      <View style={styles.dateTimeContainer}>
        <View style={styles.datePickerContainer}>
          <Text style={styles.label}>日付</Text>
          <TouchableOpacity onPress={showDatepicker} style={styles.datePickerButton}>
            <Text style={styles.datePickerText}>{formatDate(date)}</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.timePickerContainer}>
          <Text style={styles.label}>時間</Text>
          <TouchableOpacity onPress={showTimepicker} style={styles.datePickerButton}>
            <Text style={styles.datePickerText}>{formatTime(time)}</Text>
        </TouchableOpacity>
        </View>
      </View>
      
        {showDatePicker && (
          <DateTimePicker
            value={date}
            mode="date"
            display="default"
            onChange={onDateChange}
          />
        )}

        {showTimePicker && (
          <DateTimePicker
            value={time}
            mode="time"
            display="default"
            onChange={onTimeChange}
          />
        )}

      <View style={styles.inputContainer}>
        <Text style={styles.label}>参加人数上限 (オプション)</Text>
        <TextInput
          style={styles.input}
          value={maxParticipants}
          onChangeText={setMaxParticipants}
          placeholder="上限なしの場合は空欄"
          keyboardType="numeric"
        />
      </View>
      
      <View style={styles.switchContainer}>
        <Text style={styles.switchLabel}>参加承認制</Text>
        <Switch
          value={requiresApproval}
          onValueChange={setRequiresApproval}
          trackColor={{ false: '#d9d9d9', true: theme.colors.primary }}
          thumbColor={requiresApproval ? '#ffffff' : '#f4f3f4'}
        />
      </View>

        <TouchableOpacity
          style={[styles.createButton, isLoading && styles.disabledButton]}
          onPress={createEvent}
          disabled={isLoading}
        >
          <Text style={styles.createButtonText}>
            {isLoading ? '作成中...' : 'イベントを作成'}
          </Text>
        </TouchableOpacity>

      <PrefectureSelector
        visible={showPrefectureSelector}
        onClose={() => setShowPrefectureSelector(false)}
        onSelect={handlePrefectureSelect}
        initialPrefectureId={prefectureId}
        initialCityId={cityId}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  dateTimeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  datePickerContainer: {
    flex: 1,
    marginRight: 8,
  },
  timePickerContainer: {
    flex: 1,
    marginLeft: 8,
  },
  datePickerButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
  },
  datePickerText: {
    fontSize: 16,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    padding: 8,
  },
  switchLabel: {
    fontSize: 16,
  },
  createButton: {
    backgroundColor: theme.colors.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.6,
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  categoryChip: {
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    margin: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  selectedCategoryChip: {
    backgroundColor: theme.colors.primary + '20',
    borderColor: theme.colors.primary,
  },
  categoryChipText: {
    fontSize: 14,
    color: '#333',
  },
  selectedCategoryChipText: {
    color: theme.colors.primary,
    fontWeight: '500',
  },
  selectedCategoriesText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  prefectureSelector: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  prefectureText: {
    fontSize: 16,
    color: '#000',
  },
  placeholderText: {
    fontSize: 16,
    color: '#999',
  },
  errorText: {
    color: theme.colors.error,
    fontSize: 14,
    marginTop: 4,
  },
});

export default CreateEventScreen;
